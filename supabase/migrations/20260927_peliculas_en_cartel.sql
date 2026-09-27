create or replace view peliculas_con_funciones as
select distinct pelicula_id
from funciones
where inicio > now();

grant select on peliculas_con_funciones to anon, authenticated;