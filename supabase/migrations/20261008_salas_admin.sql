

create or replace function resumen_salas()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado json;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede gestionar las salas';
  end if;

  select coalesce(json_agg(json_build_object(
           'id', s.id,
           'nombre', s.nombre,
           'activa', s.activa,
           'butacas', (select count(*) from butacas b where b.sala_id = s.id),
           'estandar', (select count(*) from butacas b where b.sala_id = s.id and b.tipo = 'estandar'),
           'accesibles', (select count(*) from butacas b where b.sala_id = s.id and b.tipo = 'accesible'),
           'vip', (select count(*) from butacas b where b.sala_id = s.id and b.tipo = 'vip'),
           'funciones_futuras', (select count(*) from funciones f where f.sala_id = s.id and f.inicio > now()))
         order by s.nombre), '[]'::json)
    into v_resultado
    from salas s;

  return v_resultado;
end;
$$;

notify pgrst, 'reload schema';
