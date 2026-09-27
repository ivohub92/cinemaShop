-- Perfil del usuario. Extiende auth.users, que Supabase maneja por su cuenta.
-- Los datos son los que pidió el cliente en el correo del 01/01.

create type rol_usuario as enum ('cliente', 'empleado', 'admin');

create table perfiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text not null,
  nombre           text not null,
  apellido         text not null,
  fecha_nacimiento date not null,
  tipo_sangre      text,
  color_ojos       text,
  dias_vacaciones  smallint check (dias_vacaciones >= 0),
  rol              rol_usuario not null default 'cliente',
  creado_en        timestamptz not null default now()
);

alter table perfiles enable row level security;

-- Cada usuario ve y edita únicamente su propio perfil.
create policy "ver perfil propio"    on perfiles for select using (id = auth.uid());
create policy "crear perfil propio"  on perfiles for insert with check (id = auth.uid());
create policy "editar perfil propio" on perfiles for update using (id = auth.uid());

-- Al registrarse, Supabase crea la fila en auth.users pero no en perfiles.
-- Este trigger la genera con los datos que manda el formulario.
create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, apellido, fecha_nacimiento,
                        tipo_sangre, color_ojos, dias_vacaciones)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    (new.raw_user_meta_data->>'fecha_nacimiento')::date,
    new.raw_user_meta_data->>'tipo_sangre',
    new.raw_user_meta_data->>'color_ojos',
    (new.raw_user_meta_data->>'dias_vacaciones')::smallint
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil();