-- Géneros
insert into generos (nombre) values
  ('Acción'), ('Aventura'), ('Ciencia ficción'), ('Comedia'),
  ('Drama'), ('Policial'), ('Romance'), ('Suspenso'), ('Terror');

-- Películas
insert into peliculas (titulo, sinopsis, duracion_min, poster_url, restriccion_edad) values
  ('Doble fondo', 'Un contador descubre que la empresa donde trabaja hace treinta años no existe.', 112, 'https://placehold.co/400x600/271a45/e6e0f5?text=Doble+fondo', 13),
  ('Marea baja', 'Dos hermanas vuelven al pueblo costero donde pasaron todos los veranos de su infancia.', 98, 'https://placehold.co/400x600/271a45/e6e0f5?text=Marea+baja', 0),
  ('Órbita cero', 'La última tripulación de una estación espacial recibe una señal desde la Tierra.', 140, 'https://placehold.co/400x600/271a45/e6e0f5?text=Orbita+cero', 18),
  ('Ciudad sin sombras', 'Una detective investiga desapariciones en un barrio donde nadie quiere hablar.', 131, 'https://placehold.co/400x600/271a45/e6e0f5?text=Ciudad+sin+sombras', 13),
  ('Los relojes de Ana', 'Una relojera recibe encargos que parecen anticipar lo que va a pasar.', 121, 'https://placehold.co/400x600/271a45/e6e0f5?text=Los+relojes+de+Ana', 0),
  ('La última función', 'El proyectorista de un cine de barrio se entera de que el sábado bajan la persiana.', 95, 'https://placehold.co/400x600/271a45/e6e0f5?text=La+ultima+funcion', 0);

-- Relación entre películas y géneros, buscando los ids por nombre
insert into peliculas_generos (pelicula_id, genero_id)
select p.id, g.id
from peliculas p
join (values
  ('Doble fondo', 'Policial'),        ('Doble fondo', 'Suspenso'),
  ('Marea baja', 'Drama'),
  ('Órbita cero', 'Ciencia ficción'), ('Órbita cero', 'Suspenso'),
  ('Ciudad sin sombras', 'Policial'), ('Ciudad sin sombras', 'Acción'),
  ('Los relojes de Ana', 'Drama'),    ('Los relojes de Ana', 'Romance'),
  ('La última función', 'Comedia'),   ('La última función', 'Drama')
) as rel(titulo, genero) on rel.titulo = p.titulo
join generos g on g.nombre = rel.genero;