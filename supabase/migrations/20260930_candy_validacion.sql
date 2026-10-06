-- ============================================================================
-- Validación del candy bar: el empleado entrega los productos de una compra.
-- Las tablas (categorias_producto, productos, orden_items), sus permisos y las
-- columnas validado_candy_* de ordenes se crean en 20260929_candy.sql.
-- ============================================================================

create or replace function validar_candy(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    uuid;
  v_estado   estado_orden;
  v_validado timestamptz;
begin
  if not es_empleado() then
    raise exception 'No tenés permiso para entregar pedidos';
  end if;

  -- "for update" bloquea la orden: si dos empleados escanean el mismo QR
  -- a la vez, el segundo espera y después ve que ya fue entregado.
  select o.id, o.estado, o.validado_candy_en
    into v_orden, v_estado, v_validado
    from ordenes o
   where upper(o.codigo_qr) = upper(trim(p_codigo))
     for update;

  if v_orden is null then
    raise exception 'No existe ninguna compra con ese código';
  end if;

  if v_estado = 'cancelada' then
    raise exception 'Esta compra fue cancelada';
  end if;

  if v_estado <> 'pagada' then
    raise exception 'Esta compra no está pagada';
  end if;

  if not exists (select 1 from orden_items where orden_id = v_orden) then
    raise exception 'Esta compra no incluye productos del candy bar';
  end if;

  if v_validado is not null then
    raise exception 'Los productos de esta compra ya fueron entregados el %',
      to_char(v_validado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  update ordenes
     set validado_candy_en = now(), validado_candy_por = auth.uid()
   where id = v_orden;

  return json_build_object('id', v_orden, 'entregado', true);
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
      select json_agg(json_build_object('fila', b.fila, 'numero', b.numero, 'tipo', b.tipo, 'precio', e.precio)
                      order by b.fila, b.numero)
      from entradas e
      join butacas b on b.id = e.butaca_id
      where e.orden_id = o.id and e.estado <> 'liberada'
    ),
    'productos', (
      select coalesce(json_agg(json_build_object('nombre', pr.nombre, 'cantidad', oi.cantidad, 'precio', oi.precio_unitario)
                               order by pr.nombre), '[]'::json)
      from orden_items oi
      join productos pr on pr.id = oi.producto_id
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
      select coalesce(json_agg(json_build_object('nombre', pr.nombre, 'cantidad', oi.cantidad)
                               order by pr.nombre), '[]'::json)
      from orden_items oi
      join productos pr on pr.id = oi.producto_id
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