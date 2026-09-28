

create type estado_orden   as enum ('pendiente', 'pagada', 'cancelada', 'expirada');
create type estado_entrada as enum ('bloqueada', 'vendida', 'liberada');

create table ordenes (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references perfiles(id) on delete set null,
  email            text not null,
  fecha_nacimiento date not null,
  estado           estado_orden not null default 'pendiente',
  total            numeric(12,2) not null default 0 check (total >= 0),
  codigo_qr        text not null unique default upper(encode(gen_random_bytes(9), 'hex')),
  creado_en        timestamptz not null default now(),
  pagada_en        timestamptz,
  expira_en        timestamptz
);

create index on ordenes (usuario_id, creado_en desc);
create index on ordenes (codigo_qr);

create table entradas (
  id          uuid primary key default gen_random_uuid(),
  orden_id    uuid not null references ordenes(id)   on delete cascade,
  funcion_id  uuid not null references funciones(id) on delete restrict,
  butaca_id   uuid not null references butacas(id)   on delete restrict,
  estado      estado_entrada not null default 'bloqueada',
  precio      numeric(12,2) not null default 0 check (precio >= 0),
  tipo_butaca tipo_butaca not null,
  expira_en   timestamptz,
  creado_en   timestamptz not null default now()
);


create unique index entradas_butaca_unica
  on entradas (funcion_id, butaca_id)
  where estado <> 'liberada';

create index on entradas (orden_id);
create index on entradas (funcion_id) where estado <> 'liberada';
create index on entradas (expira_en)  where estado = 'bloqueada';


create or replace function liberar_reservas_vencidas()
returns void language plpgsql security definer set search_path = public as $$
begin
  update entradas
     set estado = 'liberada'
   where estado = 'bloqueada'
     and expira_en < now();

  update ordenes
     set estado = 'expirada'
   where estado = 'pendiente'
     and expira_en < now();
end;
$$;


alter table ordenes  enable row level security;
alter table entradas enable row level security;


create policy "ordenes propias" on ordenes for select
  using (usuario_id = auth.uid() or es_admin());

create policy "entradas propias" on entradas for select
  using (
    es_admin()
    or exists (
      select 1 from ordenes o
      where o.id = entradas.orden_id and o.usuario_id = auth.uid()
    )
  );


create or replace view butacas_ocupadas as
select funcion_id, butaca_id
from entradas
where estado <> 'liberada';

grant select on butacas_ocupadas to anon, authenticated;