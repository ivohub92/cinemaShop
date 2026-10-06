

create table if not exists auditoria (
  id            bigint generated always as identity primary key,
  usuario_id    uuid,         
  usuario_email text,         
  accion        text not null, 
  entidad       text not null, 
  entidad_id    text,
  descripcion   text,          
  detalle       jsonb,        
  creado_en     timestamptz not null default now()
);

create index if not exists auditoria_fecha_idx   on auditoria (creado_en desc);
create index if not exists auditoria_entidad_idx on auditoria (entidad, creado_en desc);

alter table auditoria enable row level security;

drop policy if exists "admin lee auditoria" on auditoria;
create policy "admin lee auditoria" on auditoria for select using (es_admin());


revoke insert, update, delete on auditoria from anon, authenticated;


create or replace function auditoria_inmutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Los registros de auditoría son de solo lectura';
end;
$$;

drop trigger if exists auditoria_solo_lectura on auditoria;
create trigger auditoria_solo_lectura
  before update or delete on auditoria
  for each row execute function auditoria_inmutable();


create or replace function auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario     uuid := auth.uid();
  v_nueva       jsonb;
  v_vieja       jsonb;
  v_fila        jsonb;
  v_detalle     jsonb;
  v_descripcion text;
begin
  if v_usuario is null then
    return null;
  end if;

  if tg_op <> 'DELETE' then v_nueva := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then v_vieja := to_jsonb(old); end if;
  v_fila := coalesce(v_nueva, v_vieja);

  if tg_table_name = 'cupones' and v_fila->>'tipo' <> 'mayores_50' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(campo, jsonb_build_object('antes', v_vieja->campo, 'despues', v_nueva->campo))
      into v_detalle
      from jsonb_object_keys(v_nueva) as campo
     where v_nueva->campo is distinct from v_vieja->campo;

    if v_detalle is null then
      return null;   -- se guardó sin cambios
    end if;
  end if;

  v_descripcion := case tg_table_name
    when 'funciones' then
      (select titulo from peliculas where id = (v_fila->>'pelicula_id')::uuid)
      || ' · ' || (v_fila->>'formato') || ' · '
      || to_char((v_fila->>'inicio')::timestamptz at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
    when 'perfiles' then
      v_fila->>'email'
    else
      coalesce(v_fila->>'titulo', v_fila->>'nombre', v_fila->>'codigo', v_fila->>'clave')
  end;

  insert into auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, descripcion, detalle)
  values (
    v_usuario,
    (select email from perfiles where id = v_usuario),
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    tg_table_name,
    coalesce(v_fila->>'id', v_fila->>'clave'),
    v_descripcion,
    v_detalle
  );

  return null;
end;
$$;

do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'peliculas', 'funciones', 'salas', 'productos', 'categorias_producto',
    'combos', 'cupones', 'recompensas', 'configuracion'
  ] loop
    execute format('drop trigger if exists %I on %I', v_tabla || '_auditar', v_tabla);
    execute format(
      'create trigger %I after insert or update or delete on %I
         for each row execute function auditar()',
      v_tabla || '_auditar', v_tabla);
  end loop;
end $$;

-- Perfiles: solo los cambios de rol (dar o quitar permisos de empleado/admin).
drop trigger if exists perfiles_auditar on perfiles;
create trigger perfiles_auditar
  after update of rol on perfiles
  for each row
  when (old.rol is distinct from new.rol)
  execute function auditar();


create or replace function auditar_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_email   text;
  v_accion  text;
begin
  if v_usuario is null then
    return null;
  end if;

  select email into v_email from perfiles where id = v_usuario;

  foreach v_accion in array array['validar_entrada', 'entregar_candy', 'cancelar_compra'] loop
    if (v_accion = 'validar_entrada' and old.validado_acceso_en is null and new.validado_acceso_en is not null)
       or (v_accion = 'entregar_candy' and old.validado_candy_en is null and new.validado_candy_en is not null)
       or (v_accion = 'cancelar_compra' and old.estado <> 'cancelada' and new.estado = 'cancelada') then
      insert into auditoria (usuario_id, usuario_email, accion, entidad, entidad_id, descripcion)
      values (v_usuario, v_email, v_accion, 'ordenes', new.id::text,
              'Compra ' || coalesce(new.codigo_qr, new.id::text) || ' · ' || new.email);
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists ordenes_auditar on ordenes;
create trigger ordenes_auditar
  after update on ordenes
  for each row execute function auditar_orden();

notify pgrst, 'reload schema';
