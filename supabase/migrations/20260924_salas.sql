do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_butaca') then
    create type tipo_butaca as enum ('estandar', 'accesible', 'vip');
  end if;
end $$;

create table if not exists salas (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true
);

create table if not exists butacas (
  id      uuid primary key default gen_random_uuid(),
  sala_id uuid not null references salas(id) on delete cascade,
  fila    char(1) not null check (fila between 'A' and 'T'),
  numero  smallint not null check (numero > 0),
  columna smallint not null check (columna between 1 and 3),
  tipo    tipo_butaca not null,
  unique (sala_id, fila, numero)
);

create index if not exists butacas_sala_idx on butacas (sala_id);

-- Genera todas las butacas de una sala según la plantilla del cliente.
create or replace function generar_butacas(p_sala_id uuid)
returns integer language plpgsql as $$
declare
  v_fila    char(1);
  v_letra   integer;
  v_tipo    tipo_butaca;
  v_dist    smallint[];
  v_columna integer;
  v_numero  integer;
  v_i       integer;
  v_total   integer := 0;
begin
  for v_letra in 0..19 loop            -- A (65) .. T (84)
    v_fila := chr(65 + v_letra);

    if v_fila in ('J', 'K') then
      v_tipo := 'accesible';
      v_dist := array[2, 10, 2];
    elsif v_fila in ('R', 'S', 'T') then
      v_tipo := 'vip';
      v_dist := array[4, 20, 4];
    else
      v_tipo := 'estandar';
      v_dist := array[4, 20, 4];
    end if;

    v_numero := 0;
    for v_columna in 1..3 loop
      for v_i in 1..v_dist[v_columna] loop
        v_numero := v_numero + 1;
        insert into butacas (sala_id, fila, numero, columna, tipo)
        values (p_sala_id, v_fila, v_numero, v_columna, v_tipo);
        v_total := v_total + 1;
      end loop;
    end loop;
  end loop;

  return v_total;                      -- 532
end;
$$;

-- Toda sala nueva nace con su mapa de butacas completo.
create or replace function trg_generar_butacas()
returns trigger language plpgsql as $$
begin
  perform generar_butacas(new.id);
  return new;
end;
$$;

drop trigger if exists salas_generar_butacas on salas;

create trigger salas_generar_butacas
  after insert on salas
  for each row execute function trg_generar_butacas();

-- ----------------------------------------------------------------------------
-- Seguridad: el mapa de butacas lo tiene que ver cualquiera que vaya a comprar,
-- incluso sin cuenta. La gestión queda reservada al administrador.
-- ----------------------------------------------------------------------------
alter table salas   enable row level security;
alter table butacas enable row level security;

drop policy if exists "lectura publica" on salas;
drop policy if exists "lectura publica" on butacas;
drop policy if exists "admin gestiona salas"   on salas;
drop policy if exists "admin gestiona butacas" on butacas;

create policy "lectura publica" on salas   for select using (true);
create policy "lectura publica" on butacas for select using (true);

create policy "admin gestiona salas"   on salas   for all using (es_admin()) with check (es_admin());
create policy "admin gestiona butacas" on butacas for all using (es_admin()) with check (es_admin());