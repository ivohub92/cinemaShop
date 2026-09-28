

alter table ordenes
  add column if not exists validado_acceso_en  timestamptz,
  add column if not exists validado_acceso_por uuid references perfiles(id);


create or replace function es_empleado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol in ('empleado', 'admin')
  );
$$;


create or replace function consultar_codigo(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_resultado json;
begin
  if not es_empleado() then
    raise exception 'No tenés permiso para validar entradas';
  end if;

  select json_build_object(
    'id', o.id,
    'estado', o.estado,
    'codigo_qr', o.codigo_qr,
    'validado_en', o.validado_acceso_en,
    'pelicula', p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala', s.nombre,
    'inicio', f.inicio,
    'formato', f.formato,
    'butacas', (
      select json_agg(json_build_object('fila', b.fila, 'numero', b.numero, 'tipo', b.tipo)
                      order by b.fila, b.numero)
      from entradas e2
      join butacas b on b.id = e2.butaca_id
      where e2.orden_id = o.id and e2.estado = 'vendida'
    )
  )
  into v_resultado
  from ordenes o
  join entradas e  on e.orden_id = o.id
  join funciones f on f.id = e.funcion_id
  join peliculas p on p.id = f.pelicula_id
  join salas s     on s.id = f.sala_id
  where upper(o.codigo_qr) = upper(trim(p_codigo))
  limit 1;

  if v_resultado is null then
    raise exception 'No existe ninguna entrada con ese código';
  end if;

  return v_resultado;
end;
$$;


create or replace function validar_acceso(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden    uuid;
  v_estado   estado_orden;
  v_validado timestamptz;
  v_inicio   timestamptz;
begin
  if not es_empleado() then
    raise exception 'No tenés permiso para validar entradas';
  end if;

  select o.id, o.estado, o.validado_acceso_en, f.inicio
    into v_orden, v_estado, v_validado, v_inicio
    from ordenes o
    join entradas e  on e.orden_id = o.id
    join funciones f on f.id = e.funcion_id
   where upper(o.codigo_qr) = upper(trim(p_codigo))
   limit 1;

  if v_orden is null then
    raise exception 'No existe ninguna entrada con ese código';
  end if;

  if v_estado = 'cancelada' then
    raise exception 'Esta compra fue cancelada';
  end if;

  if v_estado <> 'pagada' then
    raise exception 'Esta compra no está pagada';
  end if;

  if v_validado is not null then
    raise exception 'Este código ya fue utilizado el %',
      to_char(v_validado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  end if;

  update ordenes
     set validado_acceso_en = now(), validado_acceso_por = auth.uid()
   where id = v_orden;

  return json_build_object('id', v_orden, 'validado', true);
end;
$$;