-- ============================================================================
-- Reporte de combos y total del candy (RF-61, complemento). Solo admin.
-- Los productos de un combo se guardan en orden_items a precio 0: el dinero del
-- combo queda en entradas.precio (combo + recargo VIP), porque cada combo
-- incluye una entrada. Por eso reporte_productos no los ve como facturación.
-- Acá se reporta:
-- - por combo: unidades, facturado (precio del combo, entrada incluida) y la
--   parte candy estimada = precio del combo − precio base de la función.
-- - total_suelto: todos los productos vendidos sueltos (no solo el top 5).
-- Montos de lista: cupones y puntos se descuentan sobre la orden entera.
-- ============================================================================

create or replace function reporte_combos(p_desde date, p_hasta date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recargo_vip constant numeric(12,2) := 1500;  -- el mismo que reservar_butacas
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
    -- Una fila por entrada con combo; el recargo VIP no es del combo.
    select c.id as combo_id,
           c.nombre,
           e.precio - case when e.tipo_butaca = 'vip' then v_recargo_vip else 0 end as precio_combo,
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
