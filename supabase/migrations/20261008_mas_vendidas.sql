
create or replace function mas_vendidas(p_cantidad integer default 3)
returns table (pelicula_id uuid, entradas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select f.pelicula_id, count(*) as entradas
    from entradas e
    join ordenes o   on o.id = e.orden_id
    join funciones f on f.id = e.funcion_id
    join peliculas p on p.id = f.pelicula_id
   where e.estado = 'vendida'
     and o.estado = 'pagada'
     and o.pagada_en >= now() - interval '30 days'
     and p.activa
     and exists (
       select 1 from funciones prox
        where prox.pelicula_id = p.id and prox.inicio > now()
     )
   group by f.pelicula_id
   -- Desempate estable: la que vendió más recientemente va primero.
   order by entradas desc, max(o.pagada_en) desc
   limit least(greatest(p_cantidad, 1), 10);
$$;

grant execute on function mas_vendidas(integer) to anon, authenticated;

notify pgrst, 'reload schema';
