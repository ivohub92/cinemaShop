
create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin');
$$;


create policy "admin gestiona peliculas" on peliculas
  for all using (es_admin()) with check (es_admin());

create policy "admin gestiona generos" on generos
  for all using (es_admin()) with check (es_admin());

create policy "admin gestiona peliculas_generos" on peliculas_generos
  for all using (es_admin()) with check (es_admin());