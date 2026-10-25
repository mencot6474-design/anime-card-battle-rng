-- ============================================================
-- 0019_link_player_auth.sql  —  AUTH JWT, FASE 2a (LINK, TANPA RLS)
--
-- PRASYARAT: 0018 sudah jalan (kolom player_saves.user_id + unique index).
--
-- Apa yang dilakukan di sini:
--   1) RPC `link_player_auth(p_username, p_password_hash)` — menautkan baris
--      save LAMA (user_id NULL) ke akun Supabase Auth pemanggil (auth.uid()).
--      Bukti kepemilikan tetap password hash, sama seperti login sekarang,
--      jadi RPC ini tidak membuka jalur ambil-alih baru: tanpa hash yang
--      benar, link ditolak.
--   2) RPC `auth_whoami()` — buat verifikasi/debug: uid + username yang
--      tertaut ke token yang dipakai.
--
-- Yang BELUM diubah (sengaja):
--   * RLS player_saves TETAP `using(true)` untuk anon/authenticated, dan
--     grant kolom TETAP username/save_data/updated_at (0017).
--     -> Belum ada pemain yang bisa terkunci; client lama tetap jalan.
--   * RPC tulis (merge_player_state dkk) masih pakai p_password_hash.
--
-- KENAPA RLS BELUM DIBALIK DI SINI: begitu policy jadi owner-only
-- (user_id = auth.uid()), anon TIDAK BISA lagi membaca save_data — dan
-- client sekarang MEMBACA save-nya sendiri lewat anon (getUser, heartbeat
-- sid, pull di enterGame). Membalik RLS sebelum client pindah ke baca-via-JWT
-- = semua pemain kehilangan save-nya. Urutan aman:
--     2a (FILE INI) -> 2b client baca save lewat JWT (rilis) ->
--     2c baru RLS owner-only dikunci.
-- ============================================================
begin;

-- 1) Tautkan save lama ke akun Auth pemanggil.
create or replace function public.link_player_auth(
  p_username      text,
  p_password_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  u      text := lower(btrim(coalesce(p_username, '')));
  v_row  public.player_saves%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;
  if u = '' or p_password_hash is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select * into v_row from public.player_saves where username = u;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'NOT_FOUND');
  end if;
  if v_row.password is distinct from p_password_hash then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_FAILED');
  end if;

  -- Satu akun Auth cuma boleh pegang satu save (unique index 0018).
  if exists (
    select 1 from public.player_saves
     where user_id = v_uid and username <> u
  ) then
    return jsonb_build_object('ok', false, 'msg', 'UID_TAKEN');
  end if;
  -- Save sudah dipegang uid lain -> jangan pernah direbut.
  if v_row.user_id is not null and v_row.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'msg', 'USERNAME_LOCKED');
  end if;

  update public.player_saves set user_id = v_uid
   where username = u and user_id is null;

  return jsonb_build_object('ok', true, 'username', u, 'uid', v_uid);
end;
$$;

revoke all on function public.link_player_auth(text, text) from public;
grant execute on function public.link_player_auth(text, text)
  to authenticated, service_role;

-- 2) Verifikasi ringan: token siapa ini, tertaut ke username apa.
create or replace function public.auth_whoami(
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'uid', auth.uid(),
    'username', (
      select s.username from public.player_saves s
       where s.user_id = auth.uid()
       limit 1
    ));
$$;

revoke all on function public.auth_whoami() from public;
grant execute on function public.auth_whoami() to anon, authenticated, service_role;

commit;

-- ============================================================
-- VERIFIKASI (jalankan terpisah):
--   select username, user_id is not null as linked from public.player_saves
--    order by updated_at desc limit 10;
--
-- Dari client (anon key, tanpa token) -> harus AUTH_REQUIRED:
--   POST /rest/v1/rpc/link_player_auth  {"p_username":"x","p_password_hash":"y"}
-- ============================================================
