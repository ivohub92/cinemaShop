-- ============================================================================
-- Datos de demostración. Se corre DESPUÉS de todas las migraciones.
-- Se puede correr más de una vez: no duplica nada.
-- Las fechas son relativas al día en que se corre, así la demo siempre tiene
-- películas en cartel, próximos estrenos y funciones en los próximos días.
--
-- Usuarios: no se pueden crear desde acá (los maneja Supabase Auth).
-- Registrate desde la app y después dale el rol en el SQL Editor:
--   update perfiles set rol = 'admin'    where email = 'admin@ejemplo.com';
--   update perfiles set rol = 'empleado' where email = 'empleado@ejemplo.com';
-- ============================================================================

-- Géneros ---------------------------------------------------------------------
insert into generos (nombre) values
  ('Acción'), ('Aventura'), ('Ciencia ficción'), ('Comedia'),
  ('Drama'), ('Policial'), ('Romance'), ('Suspenso'), ('Terror')
on conflict (nombre) do nothing;

-- Salas: el trigger genera las 532 butacas de cada una (D-03) ------------------
insert into salas (nombre) values ('Sala 1'), ('Sala 2'), ('Sala 3')
on conflict (nombre) do nothing;

-- Películas -------------------------------------------------------------------
-- estreno: días desde hoy (negativo = ya estrenada). preventa: precio especial o null.
insert into peliculas (titulo, sinopsis, duracion_min, poster_url, restriccion_edad,
                       fecha_estreno, precio_preventa, en_portada)
select p.titulo, p.sinopsis, p.duracion, p.poster, p.edad,
       current_date + p.estreno, p.preventa, p.portada
  from (values
    ('Doble fondo', 'Un contador descubre que la empresa donde trabaja hace treinta años no existe.',
     112, 'https://placehold.co/400x600/271a45/e6e0f5?text=Doble+fondo', 13, -20, null::numeric, true),
    ('Marea baja', 'Dos hermanas vuelven al pueblo costero donde pasaron todos los veranos de su infancia.',
     98, 'https://placehold.co/400x600/271a45/e6e0f5?text=Marea+baja', 0, -15, null, false),
    ('Órbita cero', 'La última tripulación de una estación espacial recibe una señal desde la Tierra.',
     140, 'https://placehold.co/400x600/271a45/e6e0f5?text=Orbita+cero', 18, -10, null, true),
    ('Ciudad sin sombras', 'Una detective investiga desapariciones en un barrio donde nadie quiere hablar.',
     131, 'https://placehold.co/400x600/271a45/e6e0f5?text=Ciudad+sin+sombras', 13, -8, null, false),
    ('Los relojes de Ana', 'Una relojera recibe encargos que parecen anticipar lo que va a pasar.',
     121, 'https://placehold.co/400x600/271a45/e6e0f5?text=Los+relojes+de+Ana', 0, -5, null, false),
    ('La última función', 'El proyectorista de un cine de barrio se entera de que el sábado bajan la persiana.',
     95, 'https://placehold.co/400x600/271a45/e6e0f5?text=La+ultima+funcion', 0, -3, null, false),
    -- En preventa: estrena en 4 días y ya tiene funciones (RF-47).
    ('El faro del sur', 'Un guardafaros recibe cartas de alguien que dice vivir en la isla de enfrente, deshabitada desde hace un siglo.',
     118, 'https://placehold.co/400x600/271a45/e6e0f5?text=El+faro+del+sur', 13, 4, 4500, true),
    -- Próximamente: sin funciones todavía, para probar las alertas (RF-13, RF-14).
    ('Tormenta de arena', 'Una caravana cruza el desierto con un cargamento que nadie puede abrir.',
     126, 'https://placehold.co/400x600/271a45/e6e0f5?text=Tormenta+de+arena', 13, 20, null, false),
    ('Mi vecino el dragón', 'Un chico descubre que el señor del departamento de al lado es un dragón jubilado.',
     92, 'https://placehold.co/400x600/271a45/e6e0f5?text=Mi+vecino+el+dragon', 0, 25, null, false)
  ) as p(titulo, sinopsis, duracion, poster, edad, estreno, preventa, portada)
 where not exists (select 1 from peliculas where titulo = p.titulo);

insert into peliculas_generos (pelicula_id, genero_id)
select p.id, g.id
  from peliculas p
  join (values
    ('Doble fondo', 'Policial'),          ('Doble fondo', 'Suspenso'),
    ('Marea baja', 'Drama'),
    ('Órbita cero', 'Ciencia ficción'),   ('Órbita cero', 'Suspenso'),
    ('Ciudad sin sombras', 'Policial'),   ('Ciudad sin sombras', 'Acción'),
    ('Los relojes de Ana', 'Drama'),      ('Los relojes de Ana', 'Romance'),
    ('La última función', 'Comedia'),     ('La última función', 'Drama'),
    ('El faro del sur', 'Suspenso'),      ('El faro del sur', 'Drama'),
    ('Tormenta de arena', 'Aventura'),    ('Tormenta de arena', 'Acción'),
    ('Mi vecino el dragón', 'Comedia'),   ('Mi vecino el dragón', 'Aventura')
  ) as rel(titulo, genero) on rel.titulo = p.titulo
  join generos g on g.nombre = rel.genero
on conflict do nothing;

-- Funciones: próximos 7 días, 3 horarios por sala -----------------------------
-- 14:00, 17:30 y 21:00 dejan lugar a la película más larga (140 min) más los
-- 30 de limpieza, así que no se superponen (RF-26, RF-27). Las películas van
-- rotando entre salas y horarios. Solo si todavía no hay funciones cargadas.
with cartel as (
  select id, fecha_estreno, row_number() over (order by titulo) - 1 as n, count(*) over () as total
    from peliculas
   where activa and titulo in ('Doble fondo', 'Marea baja', 'Órbita cero', 'Ciudad sin sombras',
                               'Los relojes de Ana', 'La última función', 'El faro del sur')
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
 where current_date + tu.d >= c.fecha_estreno   -- la de preventa, desde su estreno
   and not exists (select 1 from funciones);

-- Combos (los productos los carga 20260929_candy.sql) --------------------------
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

-- Cupón para mayores de 50 (RF-42) ---------------------------------------------
insert into cupones (codigo, porcentaje, tipo)
values ('MAYORES50', 20, 'mayores_50')
on conflict (codigo) do nothing;

-- Recompensas por puntos (1 punto por peso pagado, RF-43) ----------------------
insert into recompensas (nombre, tipo, producto_id, costo_puntos)
select r.nombre, r.tipo, pr.id, r.costo
  from (values
    ('Entrada gratis',          'entrada',  null,             12000),
    ('Pochoclo chico de regalo', 'producto', 'Pochoclo chico', 5000)
  ) as r(nombre, tipo, producto, costo)
  left join productos pr on pr.nombre = r.producto
 where not exists (select 1 from recompensas where nombre = r.nombre);
