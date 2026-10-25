-- ============================================================
-- 0017_close_password_leak.sql  —  ANTI-CHEAT UNIT 0 (QUICK WIN)
--
-- MASALAH: setelah 0014, policy "player_saves_read" kasih anon
-- SELECT dengan USING(true) dan GRANT select menutup SEMUA kolom,
-- termasuk `password`. Anon key itu PUBLIK (nempel di supabase-sync.js),
-- jadi siapa pun bisa:
--     GET /rest/v1/player_saves?select=username,password
-- ...menyedot SEMUA username + hash password (DJB2, lemah) sekali tarik.
-- Begitu punya hash itu, dia bisa nyamar di RPC mana pun yang jaga
-- kredensial pakai p_password_hash (spend_gems, buy_global_luck,
-- submit_leaderboard_score, world_boss, dst) -> hack gems/kartu hidup lagi.
-- Ini akar impersonation-nya, lebih gawat dari RNG.
--
-- FIX (Unit 0, TANPA JWT):
--   1) Cabut SELECT anon atas KOLOM `password` (column-level grant, sisakan
--      username/save_data/updated_at — itu yang dipakai client). Hash jadi
--      tak terbaca dari REST, jadi tak bisa dipalsukan buat nyamar.
--   2) Verifikasi login pindah ke RPC definer `check_credentials`: server yang
--      membandingkan hash (jalan sbg owner, bypass grant kolom) dan TIDAK
--      pernah mengirim password ke client.
--   save_data memang masih bisa dibaca per-username (lembaga inventori/gems);
--      itu PENTINGTAS-kecil yang dihapus tuntas di Unit JWT (RLS owner-only),
--      tapi BUKAN kunci hack: tanpa hash, tak ada satu pun RPC tulis yang bisa
--      disalahgunakan. Yang ditutup di sini = jalur yang bikin hack jadi mungkin.
-- ============================================================
begin;

-- 1) Baca hanya kolom yang memang dipakai client; `password` DIKELUARKAN.
--    (0014 sudah revoke-all lalu grant select tabel penuh; kita persempit lagi.)
revoke select on public.player_saves from anon, authenticated;
grant select (username, save_data, updated_at) on public.player_saves to anon, authenticated;

-- 2) RPC verifikasi kredensial pengganti "getUser lalu bandingkan u.password".
--    Keamanan definer: boleh baca kolom password yang sudah dicabut dari anon,
--    tapi hasilnya TIDAK memuat password — hanya ok/username/sid.
--    NOT_FOUND & AUTH_FAILED sengaja disatukan msg-nya supaya tak bisa
--    enumerasi "username ini ada/tidak" lewat RPC.
create or replace function public.check_credentials(
  p_username      text,
  p_password_hash text
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
               'ok',   true,
               'username', lower(s.username),
               'sid',  s.save_data ->> 'current_session_id')
        from public.player_saves s
       where p_username is not null
         and p_password_hash is not null
         and lower(s.username) = lower(btrim(p_username))
         and s.password = p_password_hash
    ),
    jsonb_build_object('ok', false, 'msg', 'AKUN_ATAU_PASSWORD_SALAH'));
$$;

revoke all on function public.check_credentials(text, text) from public;
grant execute on function public.check_credentials(text, text) to anon, authenticated, service_role;

-- 3) Beri tahu PostgREST supaya cache schema/grant langsung diperbarui
--    (tanpa ini kolom password bisa tetap "kelihatan" dari cache lama).
select pg_notify('pgrst', 'reload schema');

commit;

-- ============================================================
-- VERIFIKASI manual (jalankan terpisah, bukan di transaksi ini):
--
--   -- (a) anon TIDAK boleh tarik kolom password lagi.
--   -- Di SQL Editor ini jalan sebagai owner (postgres) jadi pasti lolos;
--   -- buktinya ada di curl dari sisi client (anon key):
--   --   GET .../player_saves?select=username,password
--   --   -> harus 4xx (column not permitted), bukan daftar hash.
--   select public.check_credentials('username_asli','hash_yang_bener');
--   --   -> {"ok": true, "username": "...", "sid": "..."}
--   select public.check_credentials('username_asli','hash_salah');
--   --   -> {"ok": false, "msg": "AKUN_ATAU_PASSWORD_SALAH"}
-- ============================================================
