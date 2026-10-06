

insert into configuracion (clave, valor, descripcion) values
  ('recargo_3d',  1500, 'Recargo por entrada en funciones 3D (D-06)'),
  ('recargo_4d',  3000, 'Recargo por entrada en funciones 4D (D-06)'),
  ('recargo_5d',  4000, 'Recargo por entrada en funciones 5D (D-06)'),
  ('recargo_vip', 1500, 'Recargo por butaca VIP (D-06)')
on conflict (clave) do nothing;


alter table peliculas add column if not exists precio_preventa numeric(12,2)
  check (precio_preventa is null or precio_preventa >= 0);


alter table entradas add column if not exists recargo numeric(12,2) not null default 0;


update entradas set recargo = 1500 where tipo_butaca = 'vip' and recargo = 0;

create or replace function precios_funcion(p_funcion_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base      numeric(12,2);
  v_formato   text;
  v_estreno   date;
  v_preventa  numeric(12,2);
  v_hoy       date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_activa    boolean;
  v_recargo   numeric(12,2);
begin
  select f.precio_base, f.formato::text, p.fecha_estreno, p.precio_preventa
    into v_base, v_formato, v_estreno, v_preventa
    from funciones f
    join peliculas p on p.id = f.pelicula_id
   where f.id = p_funcion_id;

  if v_base is null then
    raise exception 'La función no existe';
  end if;

  v_activa := v_preventa is not null and v_hoy >= v_estreno - 7 and v_hoy < v_estreno;

  select coalesce((select valor from configuracion
                    where clave = 'recargo_' || lower(v_formato)), 0)
    into v_recargo;

  return json_build_object(
    'precio_base',     v_base,
    'preventa',        v_activa,
    'preventa_hasta',  case when v_activa then v_estreno - 1 end,
    'precio',          case when v_activa then v_preventa else v_base end,
    'formato',         v_formato,
    'recargo_formato', v_recargo,
    'recargo_vip',     coalesce((select valor from configuracion where clave = 'recargo_vip'), 0)
  );
end;
$$;

grant execute on function precios_funcion(uuid) to anon, authenticated;


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
  v_recargo_vip   numeric(12,2);
  v_recargo_fmt   numeric(12,2);
  v_recargo       numeric(12,2);
  v_precios       json;
  v_email         text;
  v_nacimiento    date;
begin
  if array_length(p_butacas, 1) is null then
    raise exception 'No elegiste ninguna butaca';
  end if;

  perform liberar_reservas_vencidas();

  select f.inicio, p.restriccion_edad
    into v_inicio, v_restriccion
    from funciones f
    join peliculas p on p.id = f.pelicula_id
   where f.id = p_funcion_id;

  if v_inicio is null then
    raise exception 'La función no existe';
  end if;


  v_precios      := precios_funcion(p_funcion_id);
  v_precio       := (v_precios->>'precio')::numeric;
  v_recargo_fmt  := (v_precios->>'recargo_formato')::numeric;
  v_recargo_vip  := (v_precios->>'recargo_vip')::numeric;

  if v_inicio < now() then
    raise exception 'La función ya comenzó';
  end if;

  if auth.uid() is not null then
    select email, fecha_nacimiento into v_email, v_nacimiento
      from perfiles
     where id = auth.uid();
  else
    v_email      := p_email;
    v_nacimiento := p_fecha_nacimiento;
  end if;

  if v_email is null or v_nacimiento is null then
    raise exception 'Faltan el correo o la fecha de nacimiento del comprador';
  end if;

  v_edad := extract(year from age(current_date, v_nacimiento));

  if v_edad < v_restriccion then
    raise exception 'La edad no alcanza la clasificación de la película';
  end if;

  insert into ordenes (usuario_id, email, fecha_nacimiento, expira_en)
  values (auth.uid(), v_email, v_nacimiento, now() + make_interval(mins => v_minutos))
  returning id into v_orden;

  foreach v_butaca in array p_butacas loop
    select tipo into v_tipo from butacas where id = v_butaca;

    if v_tipo is null then
      raise exception 'Butaca inexistente';
    end if;


    v_recargo := v_recargo_fmt + case when v_tipo = 'vip' then v_recargo_vip else 0 end;

    insert into entradas (orden_id, funcion_id, butaca_id, precio, recargo, tipo_butaca, expira_en)
    values (
      v_orden, p_funcion_id, v_butaca,
      v_precio + v_recargo,
      v_recargo,
      v_tipo,
      now() + make_interval(mins => v_minutos)
    );
  end loop;


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


    update entradas e
       set combo_id = v_combo,
           precio   = v_precio_combo + e.recargo   -- el combo reemplaza el precio base, no los recargos
     where e.id in (
       select id from entradas
        where orden_id = v_orden and combo_id is null
        order by id
        limit v_cantidad
     );

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


create or replace function reporte_combos(p_desde date, p_hasta date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado   json;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede ver los reportes';
  end if;

  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El período no es válido';
  end if;

  with pagadas as (
    select o.id
      from ordenes o
     where o.estado = 'pagada'
       and (o.pagada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  ),
  vendidos as (
    -- Una fila por entrada con combo; los recargos (formato y VIP) no son del combo.
    select c.id as combo_id,
           c.nombre,
           e.precio - e.recargo as precio_combo,
           f.precio_base
      from pagadas p
      join entradas e  on e.orden_id = p.id and e.estado = 'vendida' and e.combo_id is not null
      join combos c    on c.id = e.combo_id
      join funciones f on f.id = e.funcion_id
  ),
  por_combo as (
    select combo_id, nombre,
           count(*)                                         as unidades,
           sum(precio_combo)                                as facturado,
           sum(greatest(precio_combo - precio_base, 0))     as parte_candy
      from vendidos
     group by combo_id, nombre
  )
  select json_build_object(
    'combos', (
      select coalesce(json_agg(json_build_object(
               'combo_id', combo_id, 'nombre', nombre, 'unidades', unidades,
               'facturado', facturado, 'parte_candy', parte_candy)
             order by unidades desc, nombre), '[]'::json)
        from por_combo
    ),
    'total_suelto', (
      select coalesce(sum(oi.cantidad * oi.precio_unitario), 0)
        from pagadas p
        join orden_items oi on oi.orden_id = p.id and oi.combo_id is null
    )
  )
  into v_resultado;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';
