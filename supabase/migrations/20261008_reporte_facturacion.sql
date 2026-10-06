-- ============================================================================
-- Reporte de facturación diaria y entradas vendidas (RF-58). Solo admin.
-- - Facturación = dinero cobrado: total − crédito usado (el crédito no es un
--   ingreso nuevo, ya se cobró en la compra que se canceló).
-- - Cuenta las órdenes pagadas; las canceladas no suman y se informan aparte.
-- - Los días se cuentan en hora argentina, no en UTC.
-- ============================================================================

create or replace function reporte_facturacion(p_desde date, p_hasta date)
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

  if p_hasta - p_desde > 366 then
    raise exception 'El período no puede superar un año';
  end if;

  with dias as (
    select generate_series(p_desde, p_hasta, interval '1 day')::date as dia
  ),
  pagadas as (
    select o.id,
           (o.pagada_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
           o.total - o.credito_usado            as cobrado,
           o.credito_usado,
           o.descuento + o.descuento_puntos     as descuentos
      from ordenes o
     where o.estado = 'pagada'
       and (o.pagada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  ),
  por_dia as (
    select dia,
           count(*)           as ordenes,
           sum(cobrado)       as facturacion,
           sum(credito_usado) as credito,
           sum(descuentos)    as descuentos
      from pagadas
     group by dia
  ),
  entradas_por_dia as (
    select p.dia, count(e.id) as entradas
      from pagadas p
      join entradas e on e.orden_id = p.id and e.estado = 'vendida'
     group by p.dia
  )
  select json_build_object(
    'dias', (
      select coalesce(json_agg(json_build_object(
               'dia',         d.dia,
               'ordenes',     coalesce(pd.ordenes, 0),
               'entradas',    coalesce(ed.entradas, 0),
               'facturacion', coalesce(pd.facturacion, 0),
               'credito',     coalesce(pd.credito, 0),
               'descuentos',  coalesce(pd.descuentos, 0))
             order by d.dia desc), '[]'::json)
        from dias d
        left join por_dia pd          on pd.dia = d.dia
        left join entradas_por_dia ed on ed.dia = d.dia
    ),
    'canceladas', (
      select json_build_object('ordenes', count(*), 'monto', coalesce(sum(total), 0))
        from ordenes
       where estado = 'cancelada'
         and (cancelada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    )
  )
  into v_resultado;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';
