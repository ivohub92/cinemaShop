

create or replace function reporte_mas_vistas(p_desde date, p_hasta date, p_cantidad integer default 5)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado json;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede ver los reportes';
  end if;

  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El período no es válido';
  end if;

  select coalesce(json_agg(json_build_object(
           'pelicula_id', t.pelicula_id, 'titulo', t.titulo, 'entradas', t.entradas)
         order by t.entradas desc, t.titulo), '[]'::json)
    into v_resultado
    from (
      select p.id as pelicula_id, p.titulo, count(e.id) as entradas
        from ordenes o
        join entradas e  on e.orden_id = o.id and e.estado = 'vendida'
        join funciones f on f.id = e.funcion_id
        join peliculas p on p.id = f.pelicula_id
       where o.estado = 'pagada'
         and o.validado_acceso_en is not null
         and (o.validado_acceso_en at time zone 'America/Argentina/Buenos_Aires')::date
             between p_desde and p_hasta
       group by p.id, p.titulo
       order by entradas desc, p.titulo
       limit least(greatest(p_cantidad, 1), 20)
    ) t;

  return v_resultado;
end;
$$;

create or replace function reporte_productos(p_desde date, p_hasta date, p_cantidad integer default 5)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado json;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede ver los reportes';
  end if;

  if p_desde is null or p_hasta is null or p_desde > p_hasta then
    raise exception 'El período no es válido';
  end if;

  select coalesce(json_agg(json_build_object(
           'producto_id', t.producto_id, 'nombre', t.nombre, 'unidades', t.unidades,
           'sueltas', t.sueltas, 'en_combo', t.en_combo, 'facturado', t.facturado)
         order by t.unidades desc, t.nombre), '[]'::json)
    into v_resultado
    from (
      select pr.id as producto_id,
             pr.nombre,
             sum(oi.cantidad)                                          as unidades,
             sum(oi.cantidad) filter (where oi.combo_id is null)       as sueltas,
             sum(oi.cantidad) filter (where oi.combo_id is not null)   as en_combo,
             -- Lo de combo va a precio 0 (está en el precio del combo): solo suma lo suelto.
             sum(oi.cantidad * oi.precio_unitario)                     as facturado
        from ordenes o
        join orden_items oi on oi.orden_id = o.id
        join productos pr   on pr.id = oi.producto_id
       where o.estado = 'pagada'
         and (o.pagada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
       group by pr.id, pr.nombre
       order by unidades desc, pr.nombre
       limit least(greatest(p_cantidad, 1), 20)
    ) t;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';
