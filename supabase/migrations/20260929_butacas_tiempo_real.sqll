create or replace function avisar_cambio_butaca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funcion uuid;
  v_butaca  uuid;
  v_ocupada boolean;
begin
  if tg_op = 'DELETE' then
    v_funcion := old.funcion_id;
    v_butaca  := old.butaca_id;
    v_ocupada := false;
  else
    v_funcion := new.funcion_id;
    v_butaca  := new.butaca_id;
    v_ocupada := new.estado <> 'liberada';

    -- bloqueada → vendida: sigue ocupada, no hay nada que avisar.
    if tg_op = 'UPDATE' and (old.estado <> 'liberada') = v_ocupada then
      return null;
    end if;
  end if;

  perform realtime.send(
    jsonb_build_object('butaca_id', v_butaca, 'ocupada', v_ocupada),
    'butaca',                    -- evento
    'funcion:' || v_funcion,     -- canal
    false                        -- público: también lo escuchan los invitados
  );

  return null;
end;
$$;

drop trigger if exists entradas_avisar_cambio on entradas;
create trigger entradas_avisar_cambio
  after insert or update of estado or delete on entradas
  for each row execute function avisar_cambio_butaca();

-- Las reservas vencidas solo se liberaban cuando alguien abría un mapa.
-- Con esto se liberan solas cada minuto, y el trigger avisa a los mapas abiertos.
create extension if not exists pg_cron;

select cron.schedule(
  'liberar-reservas-vencidas',
  '* * * * *',
  $$select public.liberar_reservas_vencidas()$$
);