

create or replace function confirmar_compra(p_orden_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado  estado_orden;
  v_expira  timestamptz;
  v_usuario uuid;
begin
  select estado, expira_en, usuario_id
    into v_estado, v_expira, v_usuario
    from ordenes
   where id = p_orden_id;

  if v_estado is null then
    raise exception 'La orden no existe';
  end if;


  if v_usuario is not null and v_usuario <> auth.uid() then
    raise exception 'La orden pertenece a otro usuario';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'La orden ya no está pendiente de pago';
  end if;

  if v_expira < now() then
    raise exception 'La reserva venció. Volvé a elegir tus butacas';
  end if;

  update entradas
     set estado = 'vendida', expira_en = null
   where orden_id = p_orden_id and estado = 'bloqueada';

  update ordenes
     set estado = 'pagada', pagada_en = now(), expira_en = null
   where id = p_orden_id;

  return p_orden_id;
end;
$$;


create or replace function obtener_orden(p_orden_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_resultado json;
begin
  select json_build_object(
    'id', o.id,
    'estado', o.estado,
    'email', o.email,
    'total', o.total,
    'codigo_qr', o.codigo_qr,
    'expira_en', o.expira_en,
    'pelicula', p.titulo,
    'restriccion_edad', p.restriccion_edad,
    'sala', s.nombre,
    'inicio', f.inicio,
    'formato', f.formato,
    'idioma', f.idioma,
    'butacas', (
      select json_agg(json_build_object('fila', b.fila, 'numero', b.numero, 'tipo', b.tipo, 'precio', e.precio)
                      order by b.fila, b.numero)
      from entradas e
      join butacas b on b.id = e.butaca_id
      where e.orden_id = o.id and e.estado <> 'liberada'
    )
  )
  into v_resultado
  from ordenes o
  join entradas e  on e.orden_id = o.id
  join funciones f on f.id = e.funcion_id
  join peliculas p on p.id = f.pelicula_id
  join salas s     on s.id = f.sala_id
  where o.id = p_orden_id
  limit 1;

  if v_resultado is null then
    raise exception 'La orden no existe';
  end if;

  return v_resultado;
end;
$$;