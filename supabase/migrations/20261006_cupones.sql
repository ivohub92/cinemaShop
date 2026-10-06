-- ============================================================================
-- Cupones (RF-04, RF-41, RF-42, RN-04).
-- - Bienvenida: se crea solo al registrarse, con el % configurado en ese momento.
--   Vale para la primera compra (sin compras pagadas ni canceladas antes).
-- - Mayores de 50: los crea el admin; los ve y usa quien tenga 50 años o más.
-- - Un cupón por orden, se aplica antes que el crédito. Cada usuario usa
--   cada cupón una sola vez. Si la compra se cancela, el cupón no vuelve.
-- - Solo usuarios registrados (D-01: los beneficios requieren cuenta).
-- ============================================================================

-- Valores que el admin puede cambiar sin tocar código. Después se suman
-- los recargos de precio (D-06).
create table if not exists configuracion (
  clave       text primary key,
  valor       numeric not null,
  descripcion text
);

insert into configuracion (clave, valor, descripcion)
values ('cupon_bienvenida_pct', 10, 'Porcentaje del cupón de bienvenida (RF-41)')
on conflict (clave) do nothing;

alter table configuracion enable row level security;

drop policy if exists "lectura publica"             on configuracion;
drop policy if exists "admin gestiona configuracion" on configuracion;
create policy "lectura publica" on configuracion for select using (true);
create policy "admin gestiona configuracion" on configuracion
  for all using (es_admin()) with check (es_admin());

create table if not exists cupones (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique check (codigo = upper(codigo)),
  porcentaje smallint not null check (porcentaje between 1 and 100),
  tipo       text not null check (tipo in ('bienvenida', 'mayores_50')),
  usuario_id uuid references perfiles(id) on delete cascade,  -- dueño (solo bienvenida)
  vence_en   date,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  check ((tipo = 'bienvenida') = (usuario_id is not null))
);

-- Quién usó qué cupón. La clave primaria impide usarlo dos veces,
-- aunque dos pagos lleguen al mismo tiempo.
create table if not exists cupones_usados (
  cupon_id   uuid not null references cupones(id) on delete cascade,
  usuario_id uuid not null references perfiles(id) on delete cascade,
  orden_id   uuid references ordenes(id) on delete set null,
  usado_en   timestamptz not null default now(),
  primary key (cupon_id, usuario_id)
);

-- ordenes.total pasa a ser lo que se cobra DESPUÉS del cupón; el descuento
-- queda aparte para el comprobante y los reportes.
alter table ordenes
  add column if not exists cupon_id  uuid references cupones(id),
  add column if not exists descuento numeric(12,2) not null default 0 check (descuento >= 0);

alter table cupones        enable row level security;
alter table cupones_usados enable row level security;

drop policy if exists "admin gestiona cupones"  on cupones;
drop policy if exists "cupon propio"            on cupones;
drop policy if exists "cupones usados propios"  on cupones_usados;

create policy "admin gestiona cupones" on cupones
  for all using (es_admin()) with check (es_admin());
create policy "cupon propio" on cupones
  for select using (usuario_id = auth.uid());
create policy "cupones usados propios" on cupones_usados
  for select using (usuario_id = auth.uid() or es_admin());

-- ----------------------------------------------------------------------------
-- Cupón de bienvenida automático (RF-04).
-- ----------------------------------------------------------------------------
create or replace function crear_cupon_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol = 'cliente' then
    insert into cupones (codigo, porcentaje, tipo, usuario_id)
    values (
      'BIENVENIDA-' || upper(substr(md5(random()::text), 1, 6)),
      (select valor from configuracion where clave = 'cupon_bienvenida_pct'),
      'bienvenida',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_cupon_bienvenida on perfiles;
create trigger perfiles_cupon_bienvenida
  after insert on perfiles
  for each row execute function crear_cupon_bienvenida();

-- Los clientes que ya existían también reciben el suyo (sirve para probar).
insert into cupones (codigo, porcentaje, tipo, usuario_id)
select 'BIENVENIDA-' || upper(substr(md5(random()::text || p.id::text), 1, 6)),
       (select valor from configuracion where clave = 'cupon_bienvenida_pct'),
       'bienvenida',
       p.id
  from perfiles p
 where p.rol = 'cliente'
   and not exists (select 1 from cupones c where c.usuario_id = p.id and c.tipo = 'bienvenida');


create or replace function cupon_aplicable(p_cupon_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cupon cupones;
  v_nac   date;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_cupon from cupones where id = p_cupon_id;

  if v_cupon.id is null
     or not v_cupon.activo
     or (v_cupon.vence_en is not null and v_cupon.vence_en < current_date) then
    return false;
  end if;

  if exists (select 1 from cupones_usados where cupon_id = p_cupon_id and usuario_id = auth.uid()) then
    return false;
  end if;

  if v_cupon.tipo = 'bienvenida' then
    return v_cupon.usuario_id = auth.uid()
       and not exists (
         select 1 from ordenes
          where usuario_id = auth.uid() and estado in ('pagada', 'cancelada')
       );
  end if;


  select fecha_nacimiento into v_nac from perfiles where id = auth.uid();
  return v_nac is not null and extract(year from age(current_date, v_nac)) >= 50;
end;
$$;


create or replace function mis_cupones()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'id', c.id, 'codigo', c.codigo, 'porcentaje', c.porcentaje,
           'tipo', c.tipo, 'vence_en', c.vence_en)
         order by c.porcentaje desc), '[]'::json)
    from cupones c
   where cupon_aplicable(c.id);
$$;


drop function if exists public.confirmar_compra(uuid, boolean);

create or replace function public.confirmar_compra(
  p_orden_id     uuid,
  p_usar_credito boolean default false,
  p_cupon_id     uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden     ordenes;
  v_pct       smallint;
  v_descuento numeric(12,2) := 0;
  v_total     numeric(12,2);
  v_saldo     numeric(12,2);
  v_credito   numeric(12,2) := 0;
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

  if (p_usar_credito or p_cupon_id is not null)
     and (auth.uid() is null or v_orden.usuario_id is distinct from auth.uid()) then
    raise exception 'Los cupones y el crédito solo los puede usar el titular de la cuenta';
  end if;


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


  if p_usar_credito then
    perform 1 from perfiles where id = auth.uid() for update;

    select coalesce(sum(monto), 0) into v_saldo
      from movimientos_credito
     where usuario_id = auth.uid();

    v_credito := least(v_saldo, v_total);

    if v_credito > 0 then
      insert into movimientos_credito (usuario_id, orden_id, monto, motivo)
      values (auth.uid(), p_orden_id, -v_credito, 'pago');
    end if;
  end if;

  update entradas
     set estado = 'vendida', expira_en = null
   where orden_id = p_orden_id and estado = 'bloqueada';


  update ordenes
     set estado = 'pagada', pagada_en = now(), expira_en = null,
         cupon_id = p_cupon_id, descuento = v_descuento,
         total = v_total, credito_usado = v_credito
   where id = p_orden_id;

  return p_orden_id;
exception
  when unique_violation then
    raise exception 'Ya usaste este cupón';
end;
$$;

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
      select coalesce(json_agg(json_build_object('nombre', pr.nombre, 'cantidad', oi.cantidad,
                                                 'precio', oi.precio_unitario, 'combo', c.nombre)
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
