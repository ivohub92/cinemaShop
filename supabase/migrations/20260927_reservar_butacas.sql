create or replace function reservar_butacas(
  p_funcion_id       uuid,
  p_butacas          uuid[],
  p_email            text,
  p_fecha_nacimiento date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden       uuid;
  v_butaca      uuid;
  v_precio      numeric(12,2);
  v_tipo        tipo_butaca;
  v_restriccion smallint;
  v_edad        integer;
  v_inicio      timestamptz;
  v_minutos     constant integer := 10;
begin
  if array_length(p_butacas, 1) is null then
    raise exception 'No elegiste ninguna butaca';
  end if;


  perform liberar_reservas_vencidas();

  select f.precio_base, f.inicio, p.restriccion_edad
    into v_precio, v_inicio, v_restriccion
    from funciones f
    join peliculas p on p.id = f.pelicula_id
   where f.id = p_funcion_id;

  if v_precio is null then
    raise exception 'La función no existe';
  end if;

  if v_inicio < now() then
    raise exception 'La función ya comenzó';
  end if;

  v_edad := extract(year from age(current_date, p_fecha_nacimiento));

  if v_edad < v_restriccion then
    raise exception 'La edad no alcanza la clasificación de la película';
  end if;

  insert into ordenes (usuario_id, email, fecha_nacimiento, expira_en)
  values (auth.uid(), p_email, p_fecha_nacimiento, now() + make_interval(mins => v_minutos))
  returning id into v_orden;

  foreach v_butaca in array p_butacas loop
    select tipo into v_tipo from butacas where id = v_butaca;

    if v_tipo is null then
      raise exception 'Butaca inexistente';
    end if;

    
    insert into entradas (orden_id, funcion_id, butaca_id, precio, tipo_butaca, expira_en)
    values (
      v_orden,
      p_funcion_id,
      v_butaca,
      v_precio + case when v_tipo = 'vip' then 1500 else 0 end,
      v_tipo,
      now() + make_interval(mins => v_minutos)
    );
  end loop;

  update ordenes
     set total = (select sum(precio) from entradas where orden_id = v_orden)
   where id = v_orden;

  return v_orden;

exception
  when unique_violation then
    raise exception 'Alguna de las butacas elegidas acaba de ser tomada por otra persona';
end;
$$;