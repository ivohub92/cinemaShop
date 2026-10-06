

create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'formato_proyeccion') then
    create type formato_proyeccion as enum ('2D', '3D', '4D', '5D');
  end if;

  if not exists (select 1 from pg_type where typname = 'idioma_funcion') then
    create type idioma_funcion as enum ('castellano', 'subtitulada');
  end if;
end $$;

-- Baja lógica: una película dada de baja no se muestra en la cartelera.
alter table peliculas add column if not exists activa boolean not null default true;

create table if not exists funciones (
  id            uuid primary key default gen_random_uuid(),
  pelicula_id   uuid not null references peliculas(id) on delete restrict,
  sala_id       uuid not null references salas(id)     on delete restrict,
  inicio        timestamptz not null,
  fin           timestamptz not null,
  fin_ocupacion timestamptz not null,
  formato       formato_proyeccion not null,
  idioma        idioma_funcion not null,
  precio_base   numeric not null check (precio_base >= 0),
  creado_en     timestamptz not null default now(),
  constraint funciones_sin_solapamiento
    exclude using gist (sala_id with =, tstzrange(inicio, fin_ocupacion) with &&)
);

create index if not exists funciones_inicio_idx             on funciones (inicio);
create index if not exists funciones_pelicula_id_inicio_idx on funciones (pelicula_id, inicio);

create or replace function calcular_fin_funcion()
returns trigger
language plpgsql
as $$
declare v_duracion smallint;
begin
  select duracion_min into v_duracion from peliculas where id = new.pelicula_id;

  if v_duracion is null then
    raise exception 'No existe la película %', new.pelicula_id;
  end if;

  new.fin           := new.inicio + make_interval(mins => v_duracion);
  new.fin_ocupacion := new.fin    + make_interval(mins => 30);
  return new;
end;
$$;

drop trigger if exists funciones_calcular_fin on funciones;
create trigger funciones_calcular_fin
  before insert or update of inicio, pelicula_id on funciones
  for each row execute function calcular_fin_funcion();

alter table funciones enable row level security;

drop policy if exists "lectura publica"            on funciones;
drop policy if exists "admin gestiona funciones"   on funciones;

create policy "lectura publica"          on funciones for select using (true);
create policy "admin gestiona funciones" on funciones for all using (es_admin()) with check (es_admin());
