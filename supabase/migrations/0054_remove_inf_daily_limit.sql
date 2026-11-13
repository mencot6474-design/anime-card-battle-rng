-- ============================================================
-- 0054_remove_inf_daily_limit.sql  —  HAPUS DAILY LIMIT TOKEN INFINITE TOWER
--
-- Mengupdate `public.claim_tower_tokens(p_floor)` (terakhir di 0052):
--   * Menghapus batas harian `c_claims` (800/hari) & `c_earn` (5000/hari) / DAILY_CAP
--     sehingga pemain dapat terus memperoleh INF Token setiap lantai Tower.
--   * Tetap mempertahankan validasi input, batas `v_limit` (`UNREACHABLE`),
--     pencatatan `token_daily` (untuk ceiling potion di `_check_pots`),
--     `tower_progress`, dan `tower_roll_ledger`.
-- ============================================================
begin;

create or replace function public.claim_tower_tokens(p_floor integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gain   integer;
  v_bal    integer;
  v_front  integer;
  v_limit  integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select coalesce(max_floor, 0) into v_front
    from public.tower_progress where username = v_uname;
  v_limit := greatest(coalesce(v_front, 0) + 5, 15);
  if p_floor > v_limit then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_tower_tokens',
                           p_floor::text, v_limit::text);
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                              'max', v_limit);
  end if;

  v_gain := case when p_floor % 5 = 0 then 5 else 1 end;

  update public.player_saves
     set save_data = jsonb_set(
           coalesce(save_data, '{}'::jsonb), '{infTokens}',
           to_jsonb(public._token_of(save_data, 'infTokens') + v_gain), true),
         updated_at = now()
   where user_id = v_uid
   returning public._token_of(save_data, 'infTokens') into v_bal;

  if v_bal is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  insert into public.token_daily (username, day, claims, earned)
  values (v_uname, (now() at time zone 'utc')::date, 1, v_gain)
  on conflict (username, day) do update
     set claims = public.token_daily.claims + 1,
         earned = public.token_daily.earned + excluded.earned;

  insert into public.tower_progress (username, max_floor)
  values (v_uname, p_floor)
  on conflict (username) do update
    set max_floor = greatest(public.tower_progress.max_floor, excluded.max_floor),
        updated_at = now();

  insert into public.tower_roll_ledger (username, earned_floors, claimed_floors, updated_at)
  values (v_uname, 1, 0, now())
  on conflict (username) do update
    set earned_floors = public.tower_roll_ledger.earned_floors + 1,
        updated_at = now();

  return jsonb_build_object('ok', true, 'gained', v_gain,
                            'tokens', v_bal, 'infTokens', v_bal);
end;
$$;

revoke all on function public.claim_tower_tokens(integer) from public, anon;
grant execute on function public.claim_tower_tokens(integer) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
