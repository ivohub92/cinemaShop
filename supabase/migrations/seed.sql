insert into generos (nombre) values
  ('Acción'), ('Aventura'), ('Ciencia ficción'), ('Comedia'),
  ('Drama'), ('Policial'), ('Romance'), ('Suspenso'), ('Terror')
on conflict (nombre) do nothing;

insert into salas (nombre) values ('Sala 1'), ('Sala 2'), ('Sala 3')
on conflict (nombre) do nothing;


insert into peliculas (titulo, sinopsis, duracion_min, poster_url, restriccion_edad,
                       fecha_estreno, precio_preventa, en_portada)
select p.titulo, p.sinopsis, p.duracion, p.poster, p.edad,
       current_date + p.estreno, p.preventa, p.portada
  from (values
    ('La Sirenita', 'El clásico animado que cautivo una generacion, cobra vida.',
     112, 'https://lumiere-a.akamaihd.net/v1/images/image_73399495.jpeg?region=0%2C0%2C540%2C810', 0, -20, null::numeric, true),
    ('Titanic', 'Un barco, dos jovenes y dos distintas clases sociales. Eso no detendrá una gran historia de amor',
     98, 'https://www.tuposter.com/pub/media/catalog/product/cache/71d04d62b2100522587d43c930e8a36b/t/i/titanic_posters.png', 13, -15, null, false),
    ('Avengers Doomsday', 'El doctor Doom recorre los distintos universos buscando poder...y destruirlos',
     140, 'https://image.tmdb.org/t/p/original/40jN1UgNAYEkGt2M0i81ghLF3cc.jpg', 13, -10, null, true),
    ('Mi villano favorito 4', 'Vuelve el villano mas famoso con una nueva misión que pondrá en riesgo a su familia',
     131, 'https://pics.filmaffinity.com/despicable_me_4-802312771-large.jpg', 0, -8, null, false),
    ('Resident Evil', 'Un mensajero llega a entregar un paquete a otra ciudad donde se desata una plaga mortal',
     121, 'https://pics.filmaffinity.com/resident_evil-107033013-large.jpg', 18, -5, null, false),
    ('Cars', 'Reestreno del clásico motorizado en celebración de sus 20 años de estreno en cines',
     95, 'https://static.wikia.nocookie.net/ideas/images/9/9f/Cars_%282026_live-action_film%29_-_Poster_on_Disney_Plus..jpg/revision/latest/scale-to-width-down/1000?cb=20230209235341', 0, -3, null, false),
    -- En preventa: estrena en 4 días y ya tiene funciones (RF-47).
    ('Spiderman: Brand New Day', 'Spiderman empieza desde cero, sin un mundo que lo recuerde pero con nuevos enemigos',
     118, 'https://sm.ign.com/t/ign_es/image/n/new-spider/new-spider-man-brand-new-day-posters-released_eca9.960.jpg', 13, 4, 4500, true),
    -- Próximamente: sin funciones todavía, para probar las alertas (RF-13, RF-14).
    ('La Odisea', 'Luego de la guerra de Troya, Odiseo quiere volver a su hogar, pero los dioses y sus detractores no se lo harán fácil',
     126, 'https://www.movieposters.com/cdn/shop/files/odyssey_ver2.jpg?v=1767639159&width=1680', 18, 20, null, false),
    ('Hechizo de amor 2', 'Las hermanas Owens encuentran una oportunidad para poder acabar finalmente con la maldicion familiar, pero el precio tal vez sea demasiado alto',
     92, 'https://www.movieposters.com/cdn/shop/files/practical-magic-2_gmj332za.jpg?v=1787084011&width=1680', 13, 25, null, false)
  ) as p(titulo, sinopsis, duracion, poster, edad, estreno, preventa, portada)
 where not exists (select 1 from peliculas where titulo = p.titulo);

insert into peliculas_generos (pelicula_id, genero_id)
select p.id, g.id
  from peliculas p
  join (values
    ('La Sirenita', 'Romance'),              ('La Sirenita', 'Aventura'),
    ('Titanic', 'Drama'),                    ('Titanic', 'Romance'), -- Coma corregida aquí
    ('Avengers Doomsday', 'Ciencia ficción'), ('Avengers Doomsday', 'Acción'),
    ('Mi villano favorito 4', 'Comedia'),   ('Mi villano favorito 4', 'Aventura'),
    ('Resident Evil', 'Terror'),             ('Resident Evil', 'Suspenso'),
    ('Cars', 'Aventura'), 
    ('Spiderman: Brand New Day', 'Aventura'), ('Spiderman: Brand New Day', 'Acción'),
    ('La Odisea', 'Aventura'),               ('La Odisea', 'Drama'),
    ('Hechizo de amor 2', 'Romance')
  ) as rel(titulo, genero) on rel.titulo = p.titulo
  join generos g on g.nombre = rel.genero
on conflict do nothing;


with cartel as (
  select id, fecha_estreno, row_number() over (order by titulo) - 1 as n, count(*) over () as total
    from peliculas
   where activa and titulo in (
       'La Sirenita', 'Titanic', 'Avengers Doomsday', 
       'Mi villano favorito 4', 'Resident Evil', 'Cars', 'Spiderman: Brand New Day'
     ) 
),
salas_demo as (
  select id, row_number() over (order by nombre) - 1 as s
    from salas
   where nombre in ('Sala 1', 'Sala 2', 'Sala 3')
),
turnos as (
  select d, t, hora
    from generate_series(1, 7) as d,
         (values (0, time '14:00'), (1, time '17:30'), (2, time '21:00')) as h(t, hora)
)
insert into funciones (pelicula_id, sala_id, inicio, formato, idioma, precio_base)
select c.id,
       sa.id,
       ((current_date + tu.d) + tu.hora) at time zone 'America/Argentina/Buenos_Aires',
       (case when sa.s = 2 and tu.t = 2 then '3D' else '2D' end)::formato_proyeccion,
       (case when tu.t = 2 then 'subtitulada' else 'castellano' end)::idioma_funcion,
       case when tu.t = 0 then 5500 else 6500 end
  from turnos tu
  cross join salas_demo sa
  join cartel c on c.n = (sa.s * 3 + tu.t + tu.d) % c.total
 where current_date + tu.d >= c.fecha_estreno
   and not exists (select 1 from funciones);


insert into combos (nombre, descripcion, precio, destacado)
select c.nombre, c.descripcion, c.precio, true
  from (values
    ('Combo clásico', 'Entrada + pochoclo chico + gaseosa chica', 11500),
    ('Combo pareja',  'Entrada + pochoclo grande para compartir + gaseosa grande', 14500)
  ) as c(nombre, descripcion, precio)
 where not exists (select 1 from combos where nombre = c.nombre);

insert into combo_productos (combo_id, producto_id, cantidad)
select co.id, pr.id, rel.cantidad
  from (values
    ('Combo clásico', 'Pochoclo chico', 1),  ('Combo clásico', 'Gaseosa chica', 1),
    ('Combo pareja',  'Pochoclo grande', 1), ('Combo pareja',  'Gaseosa grande', 1)
  ) as rel(combo, producto, cantidad)
  join combos co    on co.nombre = rel.combo
  join productos pr on pr.nombre = rel.producto
on conflict do nothing;


insert into cupones (codigo, porcentaje, tipo)
values ('MAYORES50', 20, 'mayores_50')
on conflict (codigo) do nothing;


insert into recompensas (nombre, tipo, producto_id, costo_puntos)
select r.nombre, r.tipo, pr.id, r.costo
  from (values
    ('Entrada gratis',           'entrada',  null,             12000),
    ('Pochoclo chico de regalo', 'producto', 'Pochoclo chico', 5000)
  ) as r(nombre, tipo, producto, costo)
  left join productos pr on pr.nombre = r.producto
 where not exists (select 1 from recompensas where nombre = r.nombre);