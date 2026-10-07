
alter table perfiles add column if not exists dni text;
create unique index if not exists perfiles_dni_unico on perfiles (dni) where dni is not null;

-- El empleado no carga fecha de nacimiento (no compra entradas).
alter table perfiles alter column fecha_nacimiento drop not null;

drop policy if exists "crear perfil propio"  on perfiles;
drop policy if exists "editar perfil propio" on perfiles;
revoke insert, update, delete on perfiles from anon, authenticated;

create or replace function es_cliente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'cliente');
$$;

create table if not exists empleados_autorizados (
  email      text primary key check (email = lower(email)),
  nombre     text not null,
  apellido   text not null,
  dni        text not null unique,
  creado_por uuid,
  creado_en  timestamptz not null default now()
);

alter table empleados_autorizados enable row level security;
drop policy if exists "admin gestiona empleados autorizados" on empleados_autorizados;
create policy "admin gestiona empleados autorizados" on empleados_autorizados
  for all using (es_admin()) with check (es_admin());


drop trigger if exists empleados_autorizados_auditar on empleados_autorizados;
create trigger empleados_autorizados_auditar
  after insert or update or delete on empleados_autorizados
  for each row execute function auditar();

create or replace function crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_empleado  empleados_autorizados;
  v_nacimiento date := (new.raw_user_meta_data->>'fecha_nacimiento')::date;
  v_edad      integer;
begin
  select * into v_empleado from empleados_autorizados where email = lower(new.email);

  if found then
    insert into perfiles (id, email, nombre, apellido, dni, fecha_nacimiento, rol)
    values (new.id, new.email, v_empleado.nombre, v_empleado.apellido, v_empleado.dni,
            v_nacimiento, 'empleado');

    delete from empleados_autorizados where email = v_empleado.email;
    return new;
  end if;

  -- Clientes: entre 13 y 120 años, igual que en el formulario de registro.
  v_edad := extract(year from age(current_date, v_nacimiento));
  if v_nacimiento is null or v_nacimiento > current_date or v_edad < 13 or v_edad > 120 then
    raise exception 'Para registrarte tenés que tener entre 13 y 120 años';
  end if;

  if coalesce((new.raw_user_meta_data->>'dias_vacaciones')::integer, 0) < 0 then
    raise exception 'Los días de vacaciones no pueden ser negativos';
  end if;

  insert into perfiles (id, email, nombre, apellido, fecha_nacimiento,
                        tipo_sangre, color_ojos, dias_vacaciones)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    v_nacimiento,
    new.raw_user_meta_data->>'tipo_sangre',
    new.raw_user_meta_data->>'color_ojos',
    (new.raw_user_meta_data->>'dias_vacaciones')::smallint
  );
  return new;
end;
$$;


create or replace function alta_empleado(p_email text, p_nombre text, p_apellido text, p_dni text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(p_email));
  v_dni     text := trim(p_dni);
  v_perfil  perfiles;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede dar de alta empleados';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email no es válido';
  end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 or length(trim(coalesce(p_apellido, ''))) < 2 then
    raise exception 'Completá nombre y apellido';
  end if;

  if v_dni !~ '^\d{7,8}$' then
    raise exception 'El DNI tiene que tener 7 u 8 números, sin puntos';
  end if;

  if exists (select 1 from perfiles where dni = v_dni and lower(email) <> v_email)
     or exists (select 1 from empleados_autorizados where dni = v_dni and email <> v_email) then
    raise exception 'Ya hay otra persona con ese DNI';
  end if;

  select * into v_perfil from perfiles where lower(email) = v_email;

  if found then
    if v_perfil.rol = 'admin' then
      raise exception 'Ese email es de un administrador';
    end if;

    update perfiles
       set rol = 'empleado', nombre = trim(p_nombre), apellido = trim(p_apellido), dni = v_dni
     where id = v_perfil.id;
    return 'existente';
  end if;

  insert into empleados_autorizados (email, nombre, apellido, dni, creado_por)
  values (v_email, trim(p_nombre), trim(p_apellido), v_dni, auth.uid())
  on conflict (email) do update
     set nombre = excluded.nombre, apellido = excluded.apellido, dni = excluded.dni;

  return 'pendiente';
end;
$$;


create or replace function quitar_empleado(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede quitar accesos';
  end if;

  update perfiles set rol = 'cliente' where id = p_perfil_id and rol = 'empleado';

  if not found then
    raise exception 'Ese usuario no es empleado';
  end if;
end;
$$;

-- Personal para la pantalla del admin: empleados activos y altas pendientes ----
create or replace function listar_personal()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede ver el personal';
  end if;

  return (
    select coalesce(json_agg(t order by t.apellido, t.nombre), '[]'::json)
      from (
        select id::text as id, email, nombre, apellido, dni, rol::text as rol, 'activo' as estado
          from perfiles
         where rol in ('empleado', 'admin')
        union all
        select email, email, nombre, apellido, dni, 'empleado', 'pendiente'
          from empleados_autorizados
      ) t
  );
end;
$$;


create or replace function solo_clientes_compran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is not null
     and exists (select 1 from perfiles where id = new.usuario_id and rol <> 'cliente') then
    raise exception 'Las cuentas del personal no pueden comprar entradas';
  end if;
  return new;
end;
$$;

drop trigger if exists ordenes_solo_clientes on ordenes;
create trigger ordenes_solo_clientes
  before insert on ordenes
  for each row execute function solo_clientes_compran();

drop policy if exists "resenia propia: alta" on resenias;
create policy "resenia propia: alta" on resenias
  for insert with check (usuario_id = auth.uid() and es_cliente());

drop policy if exists "alertas propias: crear" on alertas_estreno;
create policy "alertas propias: crear" on alertas_estreno
  for insert with check (
    usuario_id = auth.uid()
    and es_cliente()
    and not exists (select 1 from peliculas_con_funciones v where v.pelicula_id = alertas_estreno.pelicula_id)
  );

notify pgrst, 'reload schema';
