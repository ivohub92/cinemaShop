alter table peliculas add column if not exists en_portada boolean not null default false;

notify pgrst, 'reload schema';
