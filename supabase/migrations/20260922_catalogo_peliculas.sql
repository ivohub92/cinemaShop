create table peliculas (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  sinopsis         text not null default '',
  duracion_min     smallint not null check (duracion_min > 0),
  poster_url       text,
  restriccion_edad smallint not null default 0 check (restriccion_edad in (0, 13, 18)),
  fecha_estreno    date not null default current_date,
  creado_en        timestamptz not null default now()
);

create table generos (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique
);


create table peliculas_generos (
  pelicula_id uuid references peliculas(id) on delete cascade,
  genero_id   uuid references generos(id)   on delete cascade,
  primary key (pelicula_id, genero_id)
);

create index on peliculas_generos (genero_id);

alter table peliculas          enable row level security;
alter table generos            enable row level security;
alter table peliculas_generos  enable row level security;

create policy "lectura publica" on peliculas         for select using (true);
create policy "lectura publica" on generos           for select using (true);
create policy "lectura publica" on peliculas_generos for select using (true);