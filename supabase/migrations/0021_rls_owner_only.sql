-- ============================================================
-- 0021_rls_owner_only.sql  —  AUTH JWT, FASE 2c (KUNCI RLS)
--
-- PRASYARAT: 0018 + 0019 + 0020 sudah jalan, dan client 2b sudah live
-- (baca save sendiri lewat get_my_save/get_my_session_id ber-token).
--
-- APA YANG DITUTUP DI SINI:
--   Setelah 0014/0017, anon masih bisa membaca `save_data` SEMUA pemain
--   (policy using(true)). Itu lubang terakhir: isi inventori/gems semua
--   akun bisa ditarik siapa pun yang pegang anon key.
--   Sekarang: SELECT hanya untuk PEMILIK baris (`user_id = auth.uid()`),
--   dan grant SELECT untuk anon dicabut total.
--
--   Yang tetap hidup: semua RPC definer (merge_player_state, earn_gems,
--   register_player, check_credentials, get_my_save, leaderboard, world
--   boss, profil publik) — jalan sebagai owner, RLS tidak berlaku.
--   Edge function memakai SERVICE_ROLE_KEY -> juga tidak terpengaruh.
--
--   Client lama (JS lama di cache) akan kehilangan pull cloud: getUser
--   anon mengembalikan permission error -> null -> game memakai save lokal.
--   Mitigasi: cache-bust + versi sw.js dinaikkan (rilis yang sama).
-- ============================================================
begin;

-- 1) register_player harus jujur soal nama yang sudah dipakai.
--    Sebelumnya selalu balas ok:true, padahal INSERT-nya di-skip kalau
--    username sudah ada -> client lama tidak tahu pendaftarannya gagal.
create or replace function public.register_player(
  p_username      text,
  p_password_hash text,
  p_save_data     jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u       text;
  v_taken boolean;
begin
  if p_username is null or p_password_hash is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  select exists (select 1 from public.player_saves where username = u) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', u);
  end if;

  insert into public.player_saves (username, password, save_data)
  values (u, p_password_hash, p_save_data);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

-- 2) Policy baca: hanya pemilik baris.
drop policy if exists "player_saves_read"       on public.player_saves;
drop policy if exists "player_saves_owner_read" on public.player_saves;
create policy "player_saves_owner_read"
  on public.player_saves for select
  to authenticated
  using (user_id = auth.uid());

-- 3) Anon tidak butuh baca save lagi (client pakai get_my_save).
revoke select on public.player_saves from anon;
-- Authenticated tetap boleh SELECT kolom yang dipakai; policy di atas
-- yang membatasi barisnya jadi milik sendiri.
grant select (username, save_data, updated_at) on public.player_saves to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

-- ============================================================
-- VERIFIKASI:
--   -- anon: harus 401/403/42501, bukan daftar save
--   curl "$URL/rest/v1/player_saves?select=username,save_data&limit=1" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   -- login game tetap jalan (check_credentials + get_my_save + merge)
--   -- register nama baru -> created:true ; nama lama -> created:false
-- ============================================================
