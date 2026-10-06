
create or replace function eliminar_funcion(p_funcion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ocupadas integer;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede eliminar funciones';
  end if;


  perform 1 from funciones where id = p_funcion_id for update;

  if not found then
    raise exception 'La función no existe';
  end if;

  perform liberar_reservas_vencidas();

  select count(*) into v_ocupadas
    from entradas
   where funcion_id = p_funcion_id and estado <> 'liberada';

  if v_ocupadas > 0 then
    raise exception 'No se puede eliminar: tiene % % vendida(s) o reservada(s)',
      v_ocupadas, case when v_ocupadas = 1 then 'entrada' else 'entradas' end;
  end if;

  delete from entradas  where funcion_id = p_funcion_id;   -- solo quedan reservas vencidas
  delete from funciones where id = p_funcion_id;
end;
$$;


create or replace function editar_funcion(
  p_funcion_id uuid,
  p_inicio     timestamptz,
  p_formato    formato_proyeccion,
  p_idioma     idioma_funcion,
  p_precio     numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual   funciones;
  v_ocupadas integer;
  v_sala     record;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede modificar funciones';
  end if;

  if p_precio is null or p_precio < 0 then
    raise exception 'El precio no es válido';
  end if;

  select * into v_actual from funciones where id = p_funcion_id for update;

  if not found then
    raise exception 'La función no existe';
  end if;

  if v_actual.inicio <= now() then
    raise exception 'La función ya comenzó: no se puede modificar';
  end if;

  perform liberar_reservas_vencidas();

  select count(*) into v_ocupadas
    from entradas
   where funcion_id = p_funcion_id and estado <> 'liberada';

  if v_ocupadas > 0
     and (p_inicio  is distinct from v_actual.inicio
       or p_formato is distinct from v_actual.formato
       or p_idioma  is distinct from v_actual.idioma) then
    raise exception 'Tiene % % vendida(s) o reservada(s): solo se puede cambiar el precio',
      v_ocupadas, case when v_ocupadas = 1 then 'entrada' else 'entradas' end;
  end if;

  if p_inicio = v_actual.inicio then
    update funciones
       set formato = p_formato, idioma = p_idioma, precio_base = p_precio
     where id = p_funcion_id;
    return;
  end if;

  if p_inicio <= now() then
    raise exception 'El nuevo horario ya pasó';
  end if;

  for v_sala in
    select s.id
      from salas s
      left join funciones f on f.sala_id = s.id and f.id <> p_funcion_id
     where s.activa
     group by s.id
     order by (s.id = v_actual.sala_id) desc, count(f.id), s.id
  loop
    begin

      update funciones
         set inicio = p_inicio, sala_id = v_sala.id,
             formato = p_formato, idioma = p_idioma, precio_base = p_precio
       where id = p_funcion_id;


      if v_sala.id <> v_actual.sala_id then
        delete from entradas where funcion_id = p_funcion_id;
      end if;

      return;
    exception
      when exclusion_violation then
        null;  
    end;
  end loop;

  raise exception 'No hay salas libres en ese horario';
end;
$$;

notify pgrst, 'reload schema';
