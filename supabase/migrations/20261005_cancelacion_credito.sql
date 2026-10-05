
alter table ordenes
  add column if not exists cancelada_en  timestamptz,
  add column if not exists credito_usado numeric(12,2) not null default 0 check (credito_usado >= 0);


create table if not exists movimientos_credito (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  orden_id   uuid references ordenes(id) on delete set null,
  monto      numeric(12,2) not null check (monto <> 0),
  motivo     text not null check (motivo in ('cancelacion', 'pago')),
  creado_en  timestamptz not null default now()
);

create index if not exists movimientos_credito_usuario_idx
  on movimientos_credito (usuario_id, creado_en desc);

alter table movimientos_credito enable row level security;

drop policy if exists "credito propio" on movimientos_credito;
create policy "credito propio" on movimientos_credito
  for select using (usuario_id = auth.uid() or es_admin());


create or replace function mi_credito()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(monto), 0) from movimientos_credito where usuario_id = auth.uid();
$$;


create or replace function cancelar_compra(p_orden_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden  ordenes;
  v_inicio timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para cancelar una compra';
  end if;


  select * into v_orden from ordenes where id = p_orden_id for update;

  if v_orden.id is null then
    raise exception 'La orden no existe';
  end if;

  if v_orden.usuario_id is distinct from auth.uid() then
    raise exception 'La orden pertenece a otro usuario';
  end if;

  if v_orden.estado = 'cancelada' then
    raise exception 'Esta compra ya fue cancelada';
  end if;

  if v_orden.estado <> 'pagada' then
    raise exception 'Solo se pueden cancelar compras pagadas';
  end if;

  if v_orden.validado_acceso_en is not null or v_orden.validado_candy_en is not null then
    raise exception 'Esta compra ya fue utilizada y no se puede cancelar';
  end if;

  select min(f.inicio) into v_inicio
    from entradas e
    join funciones f on f.id = e.funcion_id
   where e.orden_id = p_orden_id;

  if v_inicio - now() < interval '2 hours' then
    raise exception 'Solo se puede cancelar hasta 2 horas antes de la función';
  end if;

  update ordenes
     set estado = 'cancelada', cancelada_en = now()
   where id = p_orden_id;

  update entradas
     set estado = 'liberada'
   where orden_id = p_orden_id and estado <> 'liberada';

  if v_orden.total > 0 then
    insert into movimientos_credito (usuario_id, orden_id, monto, motivo)
    values (auth.uid(), p_orden_id, v_orden.total, 'cancelacion');
  end if;

  return v_orden.total;
end;
$$;


drop function if exists public.confirmar_compra(uuid);

create or replace function public.confirmar_compra(
  p_orden_id     uuid,
  p_usar_credito boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden   ordenes;
  v_saldo   numeric(12,2);
  v_credito numeric(12,2) := 0;
begin
  select * into v_orden from ordenes where id = p_orden_id for update;

  if v_orden.id is null then
    raise exception 'La orden no existe';
  end if;

  if v_orden.usuario_id is not null and v_orden.usuario_id <> auth.uid() then
    raise exception 'La orden pertenece a otro usuario';
  end if;

  if v_orden.estado <> 'pendiente' then
    raise exception 'La orden ya no está pendiente de pago';
  end if;

  if v_orden.expira_en < now() then
    raise exception 'La reserva venció. Volvé a elegir tus butacas';
  end if;

  if p_usar_credito then
    if auth.uid() is null or v_orden.usuario_id is distinct from auth.uid() then
      raise exception 'El crédito solo lo puede usar el titular de la cuenta';
    end if;

  
    perform 1 from perfiles where id = auth.uid() for update;

    select coalesce(sum(monto), 0) into v_saldo
      from movimientos_credito
     where usuario_id = auth.uid();

    v_credito := least(v_saldo, v_orden.total);

    if v_credito > 0 then
      insert into movimientos_credito (usuario_id, orden_id, monto, motivo)
      values (auth.uid(), p_orden_id, -v_credito, 'pago');
    end if;
  end if;

  update entradas
     set estado = 'vendida', expira_en = null
   where orden_id = p_orden_id and estado = 'bloqueada';


  update ordenes
     set estado = 'pagada', pagada_en = now(), expira_en = null, credito_usado = v_credito
   where id = p_orden_id;

  return p_orden_id;
end;
$$;


create or replace function mis_compras()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(c order by c.creado_en desc), '[]'::json)
  from (
    select o.id,
           o.estado,
           o.total,
           o.credito_usado,
           o.codigo_qr,
           o.creado_en,
           o.cancelada_en,
           o.validado_acceso_en,
           o.validado_candy_en,
           p.titulo     as pelicula,
           p.poster_url,
           f.inicio,
           s.nombre     as sala,
           (select count(*) from entradas e2 where e2.orden_id = o.id) as entradas,
           exists (select 1 from orden_items oi where oi.orden_id = o.id) as tiene_candy
      from ordenes o
      join lateral (select funcion_id from entradas where orden_id = o.id limit 1) e on true
      join funciones f on f.id = e.funcion_id
      join peliculas p on p.id = f.pelicula_id
      join salas s     on s.id = f.sala_id
     where o.usuario_id = auth.uid()
       and o.estado in ('pagada', 'cancelada')
  ) c;
$$;

notify pgrst, 'reload schema';
