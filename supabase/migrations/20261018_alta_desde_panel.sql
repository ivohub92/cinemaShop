

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


  if v_nacimiento is not null then
    v_edad := extract(year from age(current_date, v_nacimiento));
    if v_nacimiento > current_date or v_edad < 13 or v_edad > 120 then
      raise exception 'Para registrarte tenés que tener entre 13 y 120 años';
    end if;
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
