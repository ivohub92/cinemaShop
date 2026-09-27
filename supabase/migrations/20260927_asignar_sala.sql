create or replace function crear_funcion_auto(
  p_pelicula_id uuid,
  p_inicio      timestamptz,
  p_formato     formato_proyeccion,
  p_idioma      idioma_funcion,
  p_precio      numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sala     record;
  v_funcion  uuid;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede programar funciones';
  end if;


  for v_sala in
    select s.id
    from salas s
    left join funciones f on f.sala_id = s.id
    where s.activa
    group by s.id
    order by count(f.id), s.id
  loop
    begin
      insert into funciones (pelicula_id, sala_id, inicio, formato, idioma, precio_base)
      values (p_pelicula_id, v_sala.id, p_inicio, p_formato, p_idioma, p_precio)
      returning id into v_funcion;

      return v_funcion;
    exception
      when exclusion_violation then
      
        null;
    end;
  end loop;

  raise exception 'No hay salas disponibles el % a esa hora', p_inicio;
end;
$$;