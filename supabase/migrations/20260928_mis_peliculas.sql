
create or replace view mis_peliculas as
select distinct on (p.id, o.usuario_id)
       o.usuario_id,
       p.id          as pelicula_id,
       p.titulo,
       p.poster_url,
       p.duracion_min,
       f.inicio      as vista_en,
       s.nombre      as sala,
       f.formato
from ordenes o
join entradas  e on e.orden_id = o.id
join funciones f on f.id = e.funcion_id
join peliculas p on p.id = f.pelicula_id
join salas     s on s.id = f.sala_id
where o.usuario_id is not null
  and o.estado = 'pagada'
  and o.validado_acceso_en is not null
  and f.inicio < now()
order by p.id, o.usuario_id, f.inicio desc;

grant select on mis_peliculas to authenticated;