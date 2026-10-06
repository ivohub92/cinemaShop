-- ============================================================================
-- Decisión: cada combo incluye UNA entrada; su precio
-- fijo reemplaza el precio base de esa entrada (el recargo VIP se mantiene)
-- y sus productos se entregan en el candy con el mismo QR.
-- ============================================================================

create table if not exists combos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  precio      numeric(12,2) not null check (precio >= 0),
  imagen_url  text,
  activo      boolean not null default true,
  destacado   boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists combo_productos (
  combo_id    uuid not null references combos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad    smallint not null default 1 check (cantidad > 0),
  primary key (combo_id, producto_id)
);

-- Qué entrada cubre cada combo, y qué ítems del candy vienen de un combo.
alter table entradas    add column if not exists combo_id uuid references combos(id);
alter table orden_items add column if not exists combo_id uuid references combos(id);

alter table combos          enable row level security;
alter table combo_productos enable row level security;

drop policy if exists "lectura publica"       on combos;
drop policy if exists "admin gestiona combos" on combos;
drop policy if exists "lectura publica"       on combo_productos;
drop policy if exists "admin gestiona combo_productos" on combo_productos;

create policy "lectura publica"       on combos for select using (true);
create policy "admin gestiona combos" on combos for all using (es_admin()) with check (es_admin());
create policy "lectura publica"       on combo_productos for select using (true);
create policy "admin gestiona combo_productos" on combo_productos
  for all using (es_admin()) with check (es_admin());


drop function if exists public.reservar_butacas(uuid, uuid[], text, date);
drop function if exists public.reservar_butacas(uuid, uuid[], text, date, jsonb);

create or replace function public.reservar_butacas(
  p_funcion_id       uuid,
  p_butacas          uuid[],
  p_email            text,
  p_fecha_nacimiento date,
  p_productos        jsonb default '[]'::jsonb,
  p_combos           jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden         uuid;
  v_butaca        uuid;
  v_precio        numeric(12,2);
  v_tipo          tipo_butaca;
  v_restriccion   smallint;
  v_edad          integer;
  v_inicio        timestamptz;
  v_item          jsonb;
  v_precio_prod   numeric(12,2);
  v_combo         uuid;
  v_precio_combo  numeric(12,2);
  v_cantidad      integer;
  v_combos_total  integer := 0;
  v_minutos       constant integer := 10;
  v_recargo_vip   constant numeric(12,2) := 1500;
begin
  if array_length(p_butacas, 1) is null then
    raise exception 'No elegiste ninguna butaca';
  end if;

  perform liberar_reservas_vencidas();

  select f.precio_base, f.inicio, p.restriccion_edad
    into v_precio, v_inicio, v_restriccion
    from funciones f
    join peliculas p on p.id = f.pelicula_id
   where f.id = p_funcion_id;

  if v_precio is null then
    raise exception 'La función no existe';
  end if;

  if v_inicio < now() then
    raise exception 'La función ya comenzó';
  end if;

  v_edad := extract(year from age(current_date, p_fecha_nacimiento));

  if v_edad < v_restriccion then
    raise exception 'La edad no alcanza la clasificación de la película';
  end if;

  insert into ordenes (usuario_id, email, fecha_nacimiento, expira_en)
  values (auth.uid(), p_email, p_fecha_nacimiento, now() + make_interval(mins => v_minutos))
  returning id into v_orden;

  -- Entradas, a precio normal. Las que cubra un combo se ajustan más abajo.
  foreach v_butaca in array p_butacas loop
    select tipo into v_tipo from butacas where id = v_butaca;

    if v_tipo is null then
      raise exception 'Butaca inexistente';
    end if;

    insert into entradas (orden_id, funcion_id, butaca_id, precio, tipo_butaca, expira_en)
    values (
      v_orden, p_funcion_id, v_butaca,
      v_precio + case when v_tipo = 'vip' then v_recargo_vip else 0 end,
      v_tipo,
      now() + make_interval(mins => v_minutos)
    );
  end loop;

  -- Productos sueltos del candy bar. El precio se toma de la base, nunca del cliente.
  for v_item in select * from jsonb_array_elements(p_productos) loop
    select precio into v_precio_prod
      from productos
     where id = (v_item->>'id')::uuid and activo;

    if v_precio_prod is null then
      raise exception 'Producto no disponible';
    end if;

    insert into orden_items (orden_id, producto_id, cantidad, precio_unitario)
    values (v_orden, (v_item->>'id')::uuid, (v_item->>'cantidad')::smallint, v_precio_prod);
  end loop;

  -- Combos: cada uno cubre una entrada y suma sus productos a retirar.
  for v_item in select * from jsonb_array_elements(p_combos) loop
    v_combo    := (v_item->>'id')::uuid;
    v_cantidad := coalesce((v_item->>'cantidad')::integer, 0);

    if v_cantidad < 1 then
      raise exception 'Cantidad inválida para un combo';
    end if;

    select precio into v_precio_combo
      from combos
     where id = v_combo and activo;

    if v_precio_combo is null then
      raise exception 'Combo no disponible';
    end if;

    v_combos_total := v_combos_total + v_cantidad;

    if v_combos_total > array_length(p_butacas, 1) then
      raise exception 'Cada combo incluye una entrada: no puede haber más combos que butacas';
    end if;

    -- Toma entradas de la orden que todavía no tengan combo.
    update entradas e
       set combo_id = v_combo,
           precio   = v_precio_combo + case when e.tipo_butaca = 'vip' then v_recargo_vip else 0 end
     where e.id in (
       select id from entradas
        where orden_id = v_orden and combo_id is null
        order by id
        limit v_cantidad
     );

    -- Los productos del combo se copian a la orden a precio 0 (ya están en
    -- el precio del combo). Copiarlos congela el contenido: si el admin cambia
    -- el combo después, las compras hechas no se alteran (RN-03).
    insert into orden_items (orden_id, producto_id, cantidad, precio_unitario, combo_id)
    select v_orden, cp.producto_id, cp.cantidad * v_cantidad, 0, v_combo
      from combo_productos cp
     where cp.combo_id = v_combo;
  end loop;

  update ordenes
     set total = coalesce((select sum(precio) from entradas where orden_id = v_orden), 0)
               + coalesce((select sum(precio_unitario * cantidad) from orden_items where orden_id = v_orden), 0)
   where id = v_orden;

  return v_orden;

exception
  when unique_violation then
    raise exception 'Alguna de las butacas elegidas acaba de ser tomada por otra persona';
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
  join entradas e  on e.orden_id = o.id
  join funciones f on f.id = e.funcion_id
  join peliculas p on p.id = f.pelicula_id
  join salas s     on s.id = f.sala_id
  where o.id = p_orden_id
  limit 1;

  if v_resultado is null then
    raise exception 'La orden no existe';
  end if;

  return v_resultado;
end;
$$;

create or replace function consultar_codigo(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_resultado json;
begin
  if not es_empleado() then
    raise exception 'No tenés permiso para validar entradas';
  end if;

  select json_build_object(
    'id', o.id,
    'estado', o.estado,
    'codigo_qr', o.codigo_qr,
    'validado_en', o.validado_acceso_en,
    'candy_entregado_en', o.validado_candy_en,
    'pelicula', p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala', s.nombre,
    'inicio', f.inicio,
    'formato', f.formato,
    'butacas', (
      select json_agg(json_build_object('fila', b.fila, 'numero', b.numero, 'tipo', b.tipo)
                      order by b.fila, b.numero)
      from entradas e2
      join butacas b on b.id = e2.butaca_id
      where e2.orden_id = o.id and e2.estado = 'vendida'
    ),
    'productos', (
      select coalesce(json_agg(json_build_object('nombre', pr.nombre, 'cantidad', oi.cantidad,
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
  join entradas e  on e.orden_id = o.id
  join funciones f on f.id = e.funcion_id
  join peliculas p on p.id = f.pelicula_id
  join salas s     on s.id = f.sala_id
  where upper(o.codigo_qr) = upper(trim(p_codigo))
  limit 1;

  if v_resultado is null then
    raise exception 'No existe ninguna entrada con ese código';
  end if;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';