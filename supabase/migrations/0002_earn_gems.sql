-- ===========================================================
-- EARN GEMS (grinding faucet) — Token INF -> Gems
-- Jalankan di Supabase SQL Editor (atau: npx supabase db push).
--
-- Kenapa perlu RPC: merge_player_state SELALU memakai saldo cloud di
-- mode biasa, jadi "+gems" dari client akan ke-wipe tiap sync. RPC ini
-- menambah gem di sisi server supaya bertahan.
--
-- Catatan keamanan: p_gems dipercaya dari client (tower dihitung di
-- client). Ini PvE tanpa PvP / tanpa uang asli sekarang (top-up dihapus),
-- jadi minting hanya mempercepat progres player sendiri. Kalau nanti ada
-- PvP/kompetitif, validasi jumlah token di sini harus dibuat authoritative.
-- ===========================================================

create or replace function public.earn_gems(
  p_username text,
  p_password_hash text,
  p_gems integer,
  p_save_data jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_gems  integer;
  stored_pw text;
  merged    jsonb;
begin
  if p_username is null or p_gems is null or p_gems <= 0 then
    raise exception 'BAD_INPUT';
  end if;

  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0), password
    into cur_gems, stored_pw
    from public.player_saves
   where username = lower(p_username)
   for update;

  if cur_gems is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  merged := coalesce(p_save_data, (select save_data from public.player_saves
                                    where username = lower(p_username)));
  merged := jsonb_set(coalesce(merged, '{}'::jsonb), '{premiumGems}',
                      to_jsonb(cur_gems + p_gems), true);

  update public.player_saves
     set save_data = merged, updated_at = now()
   where username = lower(p_username);

  return jsonb_build_object('ok', true, 'balance', cur_gems + p_gems, 'added', p_gems);
end;
$$;

revoke all on function public.earn_gems(text, text, integer, jsonb) from public;
grant execute on function public.earn_gems(text, text, integer, jsonb) to anon, authenticated, service_role;
