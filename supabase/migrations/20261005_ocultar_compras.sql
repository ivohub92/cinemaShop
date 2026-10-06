

alter table ordenes
  add column if not exists oculta_en_historial boolean not null default false;

create or replace function ocultar_compra(p_orden_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ordenes
     set oculta_en_historial = true
   where id = p_orden_id
     and usuario_id = auth.uid()
     and estado = 'cancelada';

  if not found then
    raise exception 'Solo podés quitar del listado tus compras canceladas';
  end if;
end;
$$;

-- Misma función que antes, ahora sin las compras ocultas.
create or replace function mis_compras()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(c order by c.creado_en desc), '[]'::json)
  from (
    select o.id,
           o.estado,
           o.total,
           o.credito_usado,
           o.codigo_qr,
           o.creado_en,
           o.cancelada_en,
           o.validado_acceso_en,
           o.validado_candy_en,
           p.titulo     as pelicula,
           p.poster_url,
           f.inicio,
           s.nombre     as sala,
           (select count(*) from entradas e2 where e2.orden_id = o.id) as entradas,
           exists (select 1 from orden_items oi where oi.orden_id = o.id) as tiene_candy
      from ordenes o
      join lateral (select funcion_id from entradas where orden_id = o.id limit 1) e on true
      join funciones f on f.id = e.funcion_id
      join peliculas p on p.id = f.pelicula_id
      join salas s     on s.id = f.sala_id
     where o.usuario_id = auth.uid()
       and o.estado in ('pagada', 'cancelada')
       and not o.oculta_en_historial
  ) c;
$$;

notify pgrst, 'reload schema';
