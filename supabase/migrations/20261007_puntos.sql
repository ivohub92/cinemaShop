

create table if not exists recompensas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  tipo         text not null check (tipo in ('entrada', 'producto')),
  producto_id  uuid references productos(id),
  costo_puntos integer not null check (costo_puntos > 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  check ((tipo = 'producto') = (producto_id is not null))
);

-- Libro de puntos, igual que el de crédito: el saldo es la suma.
create table if not exists movimientos_puntos (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  orden_id   uuid references ordenes(id) on delete set null,
  puntos     integer not null check (puntos <> 0),
  motivo     text not null check (motivo in ('compra', 'canje', 'cancelacion')),
  creado_en  timestamptz not null default now()
);

create index if not exists movimientos_puntos_usuario_idx
  on movimientos_puntos (usuario_id, creado_en desc);

-- Historial de canjes (RF-05): qué recompensa, cuántos puntos y cuánto valía.
create table if not exists canjes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references perfiles(id) on delete cascade,
  orden_id      uuid references ordenes(id) on delete set null,
  recompensa_id uuid not null references recompensas(id),
  puntos        integer not null check (puntos > 0),
  valor         numeric(12,2) not null check (valor >= 0),
  creado_en     timestamptz not null default now()
);

alter table ordenes
  add column if not exists puntos_usados    integer not null default 0,
  add column if not exists descuento_puntos numeric(12,2) not null default 0,
  add column if not exists puntos_ganados   integer not null default 0;

alter table recompensas        enable row level security;
alter table movimientos_puntos enable row level security;
alter table canjes             enable row level security;

drop policy if exists "lectura publica"            on recompensas;
drop policy if exists "admin gestiona recompensas" on recompensas;
drop policy if exists "puntos propios"             on movimientos_puntos;
drop policy if exists "canjes propios"             on canjes;

create policy "lectura publica" on recompensas for select using (true);
create policy "admin gestiona recompensas" on recompensas
  for all using (es_admin()) with check (es_admin());
-- Sin políticas de escritura: solo las funciones de abajo mueven puntos.
create policy "puntos propios" on movimientos_puntos
  for select using (usuario_id = auth.uid() or es_admin());
create policy "canjes propios" on canjes
  for select using (usuario_id = auth.uid() or es_admin());

create or replace function mis_puntos()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(puntos), 0)::integer from movimientos_puntos where usuario_id = auth.uid();
$$;

create or replace function mis_canjes()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'id', c.id, 'recompensa', r.nombre, 'tipo', r.tipo,
           'puntos', c.puntos, 'valor', c.valor, 'creado_en', c.creado_en,
           'estado_orden', o.estado)
         order by c.creado_en desc), '[]'::json)
    from canjes c
    join recompensas r     on r.id = c.recompensa_id
    left join ordenes o    on o.id = c.orden_id
   where c.usuario_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- confirmar_compra: se agrega p_recompensas (una por canje; se puede repetir).
-- Cambia la lista de parámetros: se borra la versión anterior.
-- ----------------------------------------------------------------------------
drop function if exists public.confirmar_compra(uuid, boolean, uuid);

create or replace function public.confirmar_compra(
  p_orden_id     uuid,
  p_usar_credito boolean default false,
  p_cupon_id     uuid    default null,
  p_recompensas  uuid[]  default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden       ordenes;
  v_pct         smallint;
  v_descuento   numeric(12,2) := 0;
  v_total       numeric(12,2);
  v_rec         recompensas;
  v_rec_id      uuid;
  v_valor       numeric(12,2);
  v_entrada     uuid;
  v_usadas      uuid[] := '{}';   -- entradas ya cubiertas por un canje
  v_prod_usados uuid[] := '{}';   -- un elemento por unidad de producto canjeada
  v_costo       integer := 0;
  v_valor_pts   numeric(12,2) := 0;
  v_saldo_pts   integer;
  v_saldo       numeric(12,2);
  v_credito     numeric(12,2) := 0;
  v_ganados     integer := 0;
begin
  select * into v_orden from ordenes where id = p_orden_id for update;

  if v_orden.id is null then
    raise exception 'La orden no existe';
  end if;

  if v_orden.usuario_id is not null and v_orden.usuario_id <> auth.uid() then
    raise exception 'La orden pertenece a otro usuario';
  end if;

  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya no está pendiente de pago';
  end if;

  if v_orden.expira_en < now() then
    raise exception 'La reserva venció. Volvé a elegir tus butacas';
  end if;

  if (p_usar_credito or p_cupon_id is not null or cardinality(p_recompensas) > 0)
     and (auth.uid() is null or v_orden.usuario_id is distinct from auth.uid()) then
    raise exception 'Los beneficios solo los puede usar el titular de la cuenta';
  end if;

  -- Bloquea el perfil: dos pagos a la vez no pueden gastar los mismos puntos ni crédito.
  if auth.uid() is not null then
    perform 1 from perfiles where id = auth.uid() for update;
  end if;

  -- 1) Cupón
  if p_cupon_id is not null then
    if not cupon_aplicable(p_cupon_id) then
      raise exception 'El cupón no es válido para esta compra';
    end if;

    select porcentaje into v_pct from cupones where id = p_cupon_id;
    v_descuento := round(v_orden.total * v_pct / 100.0, 2);

    insert into cupones_usados (cupon_id, usuario_id, orden_id)
    values (p_cupon_id, auth.uid(), p_orden_id);
  end if;

  v_total := v_orden.total - v_descuento;

  -- 2) Puntos: cada recompensa cubre una entrada o una unidad de un producto de la orden.
  foreach v_rec_id in array p_recompensas loop
    select * into v_rec from recompensas where id = v_rec_id and activo;

    if v_rec.id is null then
      raise exception 'Una de las recompensas ya no está disponible';
    end if;

    if v_rec.tipo = 'entrada' then
      -- La entrada más cara que todavía no esté cubierta (las de combo no: su precio incluye candy).
      select e.id, e.precio into v_entrada, v_valor
        from entradas e
       where e.orden_id = p_orden_id
         and e.estado = 'bloqueada'
         and e.combo_id is null
         and e.id <> all (v_usadas)
       order by e.precio desc
       limit 1;

      if v_entrada is null then
        raise exception 'No quedan entradas para canjear en esta compra';
      end if;

      v_usadas := v_usadas || v_entrada;
      v_entrada := null;
    else
      -- Una unidad de ese producto, comprada suelta en esta orden.
      select oi.precio_unitario into v_valor
        from orden_items oi
       where oi.orden_id = p_orden_id
         and oi.producto_id = v_rec.producto_id
         and oi.combo_id is null
         and oi.cantidad > coalesce(array_length(array_positions(v_prod_usados, v_rec.producto_id), 1), 0)
       limit 1;

      if v_valor is null then
        raise exception 'Para canjear "%" tenés que tenerlo en la compra', v_rec.nombre;
      end if;

      v_prod_usados := v_prod_usados || v_rec.producto_id;
    end if;

    insert into canjes (usuario_id, orden_id, recompensa_id, puntos, valor)
    values (auth.uid(), p_orden_id, v_rec.id, v_rec.costo_puntos, v_valor);

    v_costo     := v_costo + v_rec.costo_puntos;
    v_valor_pts := v_valor_pts + v_valor;
    v_valor     := null;
  end loop;

  if v_costo > 0 then
    select coalesce(sum(puntos), 0) into v_saldo_pts
      from movimientos_puntos
     where usuario_id = auth.uid();

    if v_saldo_pts < v_costo then
      raise exception 'No te alcanzan los puntos (tenés %, necesitás %)', v_saldo_pts, v_costo;
    end if;

    insert into movimientos_puntos (usuario_id, orden_id, puntos, motivo)
    values (auth.uid(), p_orden_id, -v_costo, 'canje');

    -- Nunca más que lo que queda después del cupón.
    v_valor_pts := least(v_valor_pts, v_total);
    v_total := v_total - v_valor_pts;
  end if;

  -- 3) Crédito, sobre lo que queda
  if p_usar_credito then
    select coalesce(sum(monto), 0) into v_saldo
      from movimientos_credito
     where usuario_id = auth.uid();

    v_credito := least(v_saldo, v_total);

    if v_credito > 0 then
      insert into movimientos_credito (usuario_id, orden_id, monto, motivo)
      values (auth.uid(), p_orden_id, -v_credito, 'pago');
    end if;
  end if;

  -- 4) Lo que se paga en dinero (simulado, FA-02) suma puntos: 1 por peso (RF-43).
  if v_orden.usuario_id is not null then
    v_ganados := floor(v_total - v_credito);

    if v_ganados > 0 then
      insert into movimientos_puntos (usuario_id, orden_id, puntos, motivo)
      values (v_orden.usuario_id, p_orden_id, v_ganados, 'compra');
    end if;
  end if;

  update entradas
     set estado = 'vendida', expira_en = null
   where orden_id = p_orden_id and estado = 'bloqueada';

  -- total = lo que se cobró (crédito + dinero). Es lo que se devuelve como crédito si se cancela.
  update ordenes
     set estado = 'pagada', pagada_en = now(), expira_en = null,
         cupon_id = p_cupon_id, descuento = v_descuento,
         puntos_usados = v_costo, descuento_puntos = v_valor_pts,
         puntos_ganados = v_ganados,
         total = v_total, credito_usado = v_credito
   where id = p_orden_id;

  return p_orden_id;
exception
  when unique_violation then
    raise exception 'Ya usaste este cupón';
end;
$$;

-- ----------------------------------------------------------------------------
-- cancelar_compra: además del crédito, devuelve los puntos canjeados y quita
-- los ganados (RN-04). El saldo de puntos puede quedar negativo si ya se
-- gastaron; se compensa con las próximas compras.
-- ----------------------------------------------------------------------------
create or replace function cancelar_compra(p_orden_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden  ordenes;
  v_inicio timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para cancelar una compra';
  end if;

  select * into v_orden from ordenes where id = p_orden_id for update;

  if v_orden.id is null then
    raise exception 'La orden no existe';
  end if;

  if v_orden.usuario_id is distinct from auth.uid() then
    raise exception 'La orden pertenece a otro usuario';
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'Esta compra ya fue cancelada';
  end if;

  if v_orden.estado <> 'pagada' then
    raise exception 'Solo se pueden cancelar compras pagadas';
  end if;

  if v_orden.validado_acceso_en is not null or v_orden.validado_candy_en is not null then
    raise exception 'Esta compra ya fue utilizada y no se puede cancelar';
  end if;

  select min(f.inicio) into v_inicio
    from entradas e
    join funciones f on f.id = e.funcion_id
   where e.orden_id = p_orden_id;

  if v_inicio - now() < interval '2 hours' then
    raise exception 'Solo se puede cancelar hasta 2 horas antes de la función';
  end if;

  update ordenes
     set estado = 'cancelada', cancelada_en = now()
   where id = p_orden_id;

  update entradas
     set estado = 'liberada'
   where orden_id = p_orden_id and estado <> 'liberada';

  if v_orden.total > 0 then
    insert into movimientos_credito (usuario_id, orden_id, monto, motivo)
    values (auth.uid(), p_orden_id, v_orden.total, 'cancelacion');
  end if;

  if v_orden.puntos_usados - v_orden.puntos_ganados <> 0 then
    insert into movimientos_puntos (usuario_id, orden_id, puntos, motivo)
    values (auth.uid(), p_orden_id, v_orden.puntos_usados - v_orden.puntos_ganados, 'cancelacion');
  end if;

  return v_orden.total;
end;
$$;

-- ----------------------------------------------------------------------------
-- obtener_orden: suma puntos y el id de cada producto (para saber qué se puede canjear).
-- ----------------------------------------------------------------------------
create or replace function obtener_orden(p_orden_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_resultado json;
begin
  select json_build_object(
    'id', o.id,
    'estado', o.estado,
    'email', o.email,
    'total', o.total,
    'descuento', o.descuento,
    'cupon', cu.codigo,
    'puntos_usados', o.puntos_usados,
    'descuento_puntos', o.descuento_puntos,
    'puntos_ganados', o.puntos_ganados,
    'credito_usado', o.credito_usado,
    'codigo_qr', o.codigo_qr,
    'expira_en', o.expira_en,
    'pelicula', p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala', s.nombre,
    'inicio', f.inicio,
    'formato', f.formato,
    'idioma', f.idioma,
    'butacas', (
      select json_agg(json_build_object('fila', b.fila, 'numero', b.numero, 'tipo', b.tipo,
                                        'precio', e.precio, 'combo', c.nombre)
                      order by b.fila, b.numero)
      from entradas e
      join butacas b     on b.id = e.butaca_id
      left join combos c on c.id = e.combo_id
      where e.orden_id = o.id and e.estado <> 'liberada'
    ),
    'productos', (
      select coalesce(json_agg(json_build_object('producto_id', pr.id, 'nombre', pr.nombre,
                                                 'cantidad', oi.cantidad, 'precio', oi.precio_unitario,
                                                 'combo', c.nombre)
                               order by c.nombre nulls first, pr.nombre), '[]'::json)
      from orden_items oi
      join productos pr  on pr.id = oi.producto_id
      left join combos c on c.id = oi.combo_id
      where oi.orden_id = o.id
    )
  )
  into v_resultado
  from ordenes o
  join entradas e        on e.orden_id = o.id
  join funciones f       on f.id = e.funcion_id
  join peliculas p       on p.id = f.pelicula_id
  join salas s           on s.id = f.sala_id
  left join cupones cu   on cu.id = o.cupon_id
  where o.id = p_orden_id
  limit 1;

  if v_resultado is null then
    raise exception 'La orden no existe';
  end if;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';
