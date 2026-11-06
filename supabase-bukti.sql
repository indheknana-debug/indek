-- Catatan Keuangan Indek: penyimpanan bukti pembayaran (foto, gambar, file)
-- Jalankan sekali di Supabase > SQL Editor > New query > tempel semua > Run.
-- Setiap akun hanya bisa melihat, mengunggah, dan menghapus bukti miliknya sendiri.

insert into storage.buckets (id, name, public, file_size_limit)
values ('bukti', 'bukti', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists "bukti: lihat milik sendiri" on storage.objects;
create policy "bukti: lihat milik sendiri" on storage.objects for select to authenticated
  using (bucket_id = 'bukti' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bukti: unggah milik sendiri" on storage.objects;
create policy "bukti: unggah milik sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'bukti' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bukti: ubah milik sendiri" on storage.objects;
create policy "bukti: ubah milik sendiri" on storage.objects for update to authenticated
  using (bucket_id = 'bukti' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'bukti' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "bukti: hapus milik sendiri" on storage.objects;
create policy "bukti: hapus milik sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'bukti' and (storage.foldername(name))[1] = auth.uid()::text);
