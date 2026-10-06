create table categorias_producto (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden  smallint not null default 0
);

create table productos (
  id           uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias_producto(id) on delete restrict,
  nombre       text not null,
  descripcion  text,
  precio       numeric(12,2) not null check (precio >= 0),
  imagen_url   text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create index on productos (categoria_id);

create table orden_items (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references ordenes(id)    on delete cascade,
  producto_id     uuid not null references productos(id)  on delete restrict,
  cantidad        smallint not null default 1 check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0)
);

create index on orden_items (orden_id);


alter table ordenes
  add column if not exists validado_candy_en  timestamptz,
  add column if not exists validado_candy_por uuid references perfiles(id);


alter table categorias_producto enable row level security;
alter table productos           enable row level security;
alter table orden_items         enable row level security;

create policy "lectura publica" on categorias_producto for select using (true);
create policy "lectura publica" on productos           for select using (true);

create policy "admin gestiona categorias" on categorias_producto
  for all using (es_admin()) with check (es_admin());

create policy "admin gestiona productos" on productos
  for all using (es_admin()) with check (es_admin());


create policy "items propios" on orden_items for select
  using (
    es_empleado()
    or exists (
      select 1 from ordenes o
      where o.id = orden_items.orden_id and o.usuario_id = auth.uid()
    )
  );


insert into categorias_producto (nombre, orden) values
  ('Pochoclos', 1), ('Bebidas', 2), ('Golosinas', 3);
-- Los combos no son una categoría: tienen su propia tabla (20260930_combos.sql).

insert into productos (categoria_id, nombre, descripcion, precio)
select c.id, p.nombre, p.descripcion, p.precio
from (values
  ('Pochoclos', 'Pochoclo chico',   'Balde de 45 oz',              3500),
  ('Pochoclos', 'Pochoclo grande',  'Balde de 85 oz, para compartir', 5200),
  ('Bebidas',   'Gaseosa chica',    '500 ml',                      2800),
  ('Bebidas',   'Gaseosa grande',   '1 litro',                     3900),
  ('Bebidas',   'Agua mineral',     '500 ml',                      2200),
  ('Golosinas', 'Barra de chocolate', null,                        2500),
  ('Golosinas', 'Nachos con queso', 'Porción individual',          4800)
) as p(categoria, nombre, descripcion, precio)
join categorias_producto c on c.nombre = p.categoria;