
create table if not exists alertas_estreno (
  usuario_id  uuid not null references perfiles(id)  on delete cascade,
  pelicula_id uuid not null references peliculas(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, pelicula_id)
);

create table if not exists notificaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  titulo     text not null,
  mensaje    text not null,
  url        text,                 -- ruta de la app a la que lleva al tocarla
  leida_en   timestamptz,
  creado_en  timestamptz not null default now()
);

create index if not exists notificaciones_usuario_idx on notificaciones (usuario_id, creado_en desc);

alter table alertas_estreno enable row level security;
alter table notificaciones  enable row level security;

drop policy if exists "alertas propias: ver"     on alertas_estreno;
drop policy if exists "alertas propias: crear"   on alertas_estreno;
drop policy if exists "alertas propias: borrar"  on alertas_estreno;
drop policy if exists "notificaciones propias"   on notificaciones;

create policy "alertas propias: ver" on alertas_estreno
  for select using (usuario_id = auth.uid());

-- Solo para películas que todavía no están a la venta (las de "Próximamente").
create policy "alertas propias: crear" on alertas_estreno
  for insert with check (
    usuario_id = auth.uid()
    and not exists (select 1 from peliculas_con_funciones v where v.pelicula_id = alertas_estreno.pelicula_id)
  );

create policy "alertas propias: borrar" on alertas_estreno
  for delete using (usuario_id = auth.uid());


create policy "notificaciones propias" on notificaciones
  for select using (usuario_id = auth.uid());


create or replace function avisar_estreno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
begin
  if new.inicio <= now() then
    return null;
  end if;

  select titulo into v_titulo from peliculas where id = new.pelicula_id;


  with cumplidas as (
    delete from alertas_estreno
     where pelicula_id = new.pelicula_id
    returning usuario_id
  )
  insert into notificaciones (usuario_id, titulo, mensaje, url)
  select usuario_id,
         'Ya están a la venta las entradas',
         'Salieron a la venta las entradas de "' || v_titulo || '".',
         '/peliculas/' || new.pelicula_id
    from cumplidas;

  return null;
end;
$$;

drop trigger if exists funciones_avisar_estreno on funciones;
create trigger funciones_avisar_estreno
  after insert on funciones
  for each row execute function avisar_estreno();


create or replace function marcar_notificaciones_leidas()
returns void
language sql
security definer
set search_path = public
as $$
  update notificaciones
     set leida_en = now()
   where usuario_id = auth.uid() and leida_en is null;
$$;


do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table notificaciones;
  end if;
end $$;

notify pgrst, 'reload schema';
