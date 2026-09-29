create table resenias (
  id          uuid primary key default gen_random_uuid(),
  pelicula_id uuid not null references peliculas(id) on delete cascade,
  usuario_id  uuid not null references perfiles(id)  on delete cascade,
  puntaje     smallint not null check (puntaje between 1 and 5),
  comentario  text check (char_length(comentario) <= 500),
  creado_en   timestamptz not null default now(),
  -- Una reseña por persona y película: si vuelve a opinar, edita la suya.
  unique (pelicula_id, usuario_id)
);

create index on resenias (pelicula_id);


create or replace view puntajes_peliculas as
select p.id as pelicula_id,
       round(avg(r.puntaje)::numeric, 1) as promedio,
       count(r.id) as cantidad
from peliculas p
left join resenias r on r.pelicula_id = p.id
group by p.id;

grant select on puntajes_peliculas to anon, authenticated;

alter table resenias enable row level security;

create policy "lectura publica" on resenias for select using (true);

create policy "resenia propia: alta"    on resenias for insert with check (usuario_id = auth.uid());
create policy "resenia propia: edicion" on resenias for update using (usuario_id = auth.uid());
create policy "resenia propia: baja"    on resenias for delete using (usuario_id = auth.uid() or es_admin());



create or replace view resenias_publicas as
select r.id,
       r.pelicula_id,
       r.usuario_id,
       r.puntaje,
       r.comentario,
       r.creado_en,
       p.nombre as autor,
       exists (
         select 1
         from entradas e
         join funciones f on f.id = e.funcion_id
         join ordenes  o on o.id = e.orden_id
         where f.pelicula_id = r.pelicula_id
           and o.usuario_id  = r.usuario_id
           and o.validado_acceso_en is not null
       ) as verificada
from resenias r
join perfiles p on p.id = r.usuario_id;

grant select on resenias_publicas to anon, authenticated;