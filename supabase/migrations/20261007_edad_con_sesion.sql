

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
  v_email         text;
  v_nacimiento    date;
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

  -- Con sesión iniciada valen SIEMPRE los datos del perfil: así nadie puede
  -- declarar otra fecha de nacimiento para saltear la clasificación (RN-02).
  -- Los parámetros solo se usan en la compra como invitado (D-01).
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

notify pgrst, 'reload schema';
