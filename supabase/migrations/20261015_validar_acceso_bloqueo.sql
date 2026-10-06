-- ============================================================================
-- validar_acceso con bloqueo de la orden, igual que validar_candy.
-- Sin "for update", si dos empleados escaneaban el mismo QR al mismo tiempo,
-- los dos leían "sin validar" y los dos dejaban pasar. Ahora el segundo
-- espera a que termine el primero y recibe "ya fue utilizado".
-- ============================================================================

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
begin
  if not es_empleado() then
    raise exception 'No tenés permiso para validar entradas';
  end if;

  select o.id, o.estado, o.validado_acceso_en
    into v_orden, v_estado, v_validado
    from ordenes o
   where upper(o.codigo_qr) = upper(trim(p_codigo))
     for update;

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

notify pgrst, 'reload schema';
