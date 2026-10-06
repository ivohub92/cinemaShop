-- ============================================================================
-- Las funciones solo se programan a futuro. crear_funcion_auto no controlaba
-- la fecha: con la pantalla o llamando a la API se podía crear una función en
-- el pasado. Misma firma: "create or replace" la reemplaza.
-- (editar_funcion ya rechaza horarios pasados.)
-- ============================================================================

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

  if p_inicio <= now() then
    raise exception 'No se pueden programar funciones en fechas u horarios que ya pasaron';
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

notify pgrst, 'reload schema';
