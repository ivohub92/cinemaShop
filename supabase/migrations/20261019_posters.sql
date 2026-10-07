-- ============================================================================
-- Pósters subidos desde la computadora (además de pegar una URL).
-- Bucket público "posters" en Supabase Storage: cualquiera puede ver las
-- imágenes (la cartelera es pública), solo el admin puede subir, cambiar o
-- borrar. La película guarda la URL pública en peliculas.poster_url, igual
-- que cuando se pega un link.
-- Límites del bucket: 2 MB por archivo, solo JPG, PNG y WebP.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "posters: lectura publica" on storage.objects;
drop policy if exists "posters: admin sube"      on storage.objects;
drop policy if exists "posters: admin cambia"    on storage.objects;
drop policy if exists "posters: admin borra"     on storage.objects;

create policy "posters: lectura publica" on storage.objects
  for select using (bucket_id = 'posters');

create policy "posters: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'posters' and public.es_admin());

create policy "posters: admin cambia" on storage.objects
  for update to authenticated using (bucket_id = 'posters' and public.es_admin());

create policy "posters: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'posters' and public.es_admin());
