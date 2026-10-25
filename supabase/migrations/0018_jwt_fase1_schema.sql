-- ============================================================
-- 0018_jwt_fase1_schema.sql  —  AUTH JWT, FASE 1 (SKEMA SAJA)
--
-- TUJUAN FASE 1: cuma bikin pondasi buat migrasi ke Supabase Auth (JWT),
-- TANPA mengubah perilaku apa pun yang lagi jalan. Semua additions
-- NULLABLE -> login/RPC model lama (p_password_hash) tetap hidup seratus
-- persen. Ini sengaja dibikin "additive only" supaya bisa dijalankan HARI
-- INI juga, jauh sebelum client pindah ke supabase-js.
--
-- PETA FASE (jangan lompat):
--   Fase 1 (FILE INI)   : kolom join `user_id` + index. Nol risiko.
--   Fase 2 (0019 nanti)  : RPC definer `link_player_auth` (legacy user link
--                         akun Auth-nya ke save lama) + balikin RLS
--                         player_saves ke OWNER-ONLY (`user_id = auth.uid()`)
--                         -> inilah yang nutup sisa kebocoran save_data.
--   Fase 3 (0020 nanti)  : semua tulis-RPC cek `auth.uid()`, buangnya
--                         `p_password_hash`; hapus kolom `password`,
--                         `hashPass`, `_localPassHash`.
--
-- CATATAN DESAIN (kenapa email sintetis):
--   Supabase Auth (`auth.users`) butuh identifier email/telepon; game kita
--   cuma username+password. Solusi free-tier yang tidak perlu admin-key:
--   client `signUp` dengan email `username + "@game.invalid"`. Domain
--   `.invalid` (RFC2606) mustahil jadi email betulan -> tak ada email
--   verifikasi yang bocor ke luar, dan satu username = satu akun Auth.
--   Jadi TIDAK ada tabel baru di sini; kita pakai auth.users bawaan,
--   dan `player_saves.user_id` cuma menaruh id-nya.
-- ============================================================
begin;

-- 1) Kolom join ke auth.users. Nullable -> tidak memaksa backfill sekarang.
alter table public.player_saves
  add column if not exists user_id uuid;

-- 2) Index lookup (profil/leaderboard kelak resolve uid -> username) dan
--    jaminan 1 akun Auth = 1 save (hanya untuk baris yang sudah ter-link).
create index if not exists idx_player_saves_user_id
  on public.player_saves (user_id)
  where user_id is not null;

-- unique partial: satu uid tak boleh pegang 2 save. (Baris user_id NULL /
-- legacy tidak kena constraint ini, jadi tambah kolom di atas tidak meledak.)
create unique index if not exists uniq_player_saves_user_id
  on public.player_saves (user_id)
  where user_id is not null;

-- 3) Kolom baru TIDAK otomatis readable via REST; pertahankan grant 0017
--    (anon cuma username/save_data/updated_at). user_id memang tidak perlu
--    keluar ke client. Tidak ada perubahan grant di sini.
--    (Klausul ini cuma dokumentasi; tidak mengubah apa pun.)

commit;

-- ============================================================
-- VERIFIKASI (jalankan terpisah):
--   select column_name, data_type from information_schema.columns
--    where table_name = 'player_saves' order by ordinal_position;
--   -- -> harus tampil kolom `user_id uuid` di akhir.
--   select indexname from pg_indexes where tablename='player_saves';
--   -- -> ada idx_player_saves_user_id + uniq_player_saves_user_id.
--
-- Setelah ini login lama HARUS tetap jalan (belum ada yang berubah).
-- Baru Fase 2 (0019) yang menyentuh RLS — jangan dijalankan sampai client
-- siap, atau player langsung terkunci dari save_data.
-- ============================================================
