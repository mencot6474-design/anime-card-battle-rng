-- ============================================================
-- 0014_lock_player_saves.sql  —  ANTI-CHEAT UNIT 1
-- Lubang induk: player_saves punya policy "Allow all actions" &
-- "Allow public all" (cmd=ALL, roles={public}, qual/with_check=true)
-- -> anon/authenticated bisa INSERT/UPDATE/DELETE baris mana pun.
-- Hack cukup curl PATCH save_data (bypass semua RPC, termasuk gems).
--
-- FIX: tulis lewat RPC security definer saja (merge_player_state,
-- earn/spend_gems, settle_topup, redeem_code, world_boss, dst — jalan
-- sebagai owner postgres, bypass RLS karena relforcerowsecurity=false).
-- Anon/authenticated cuma boleh SELECT (getUser/getSessionId/ranking).
-- Register dipindah ke RPC register_player.
--
-- global_luck sengaja TIDAK dikunci di sini (punya jalur tulis langsung
-- stackGlobalLuck) -> ditangani unit tersendiri biar fitur tak mati.
-- ============================================================
begin;

-- 1) Buang policy tulis publik lama pada player_saves.
drop policy if exists "Allow all actions" on public.player_saves;
drop policy if exists "Allow public all"  on public.player_saves;
drop policy if exists "player_saves_read" on public.player_saves;

-- 2) Hanya boleh baca (read profil/leaderboard/heartbeat tetap jalan).
create policy "player_saves_read"
  on public.player_saves for select
  to anon, authenticated
  using (true);

-- 3) Cabut grant tulis, sisakan SELECT (pertahanan berlapis di atas RLS).
revoke all on public.player_saves from anon, authenticated;
grant select on public.player_saves to anon, authenticated;

-- 4) Register jadi RPC definer (anon tak bisa INSERT langsung lagi).
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
  u text;
begin
  if p_username is null or p_password_hash is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  insert into public.player_saves (username, password, save_data)
  select u, p_password_hash, p_save_data
  where not exists (select 1 from public.player_saves where username = u);

  return jsonb_build_object('ok', true, 'username', u);
end;
$$;

revoke all on function public.register_player(text, text, jsonb) from public;
grant execute on function public.register_player(text, text, jsonb)
  to anon, authenticated, service_role;

commit;
