-- ============================================================================
-- Migration 0049: Server-Authoritative Rewarded Ads (Watch Ads Terminal)
--   1) Table `public.ad_reward_state`: tracks server-side timers & daily caps
--      for Watch Ads rewards (`gems`, `luck`, `pack100k`).
--   2) `_luck_of(p_save, p_uname)`: incorporates active x2 Ad Luck from
--      `ad_reward_state.luck_ends_at > now()`.
--   3) RPC `public.get_ad_reward_state()`: returns current server timers.
--   4) RPC `public.claim_ad_reward(p_kind, p_luck)`: validates cooldown/cap,
--      grants +25 Gems, activates x2 Ad Luck (5 min), or grants + rolls x1
--      100k Roll Pack via `public.bulk_roll('r100k', 1, p_luck)`.
-- ============================================================================

create table if not exists public.ad_reward_state (
  username         text primary key,
  luck_ends_at     timestamptz,
  pack_cd_ends_at  timestamptz,
  gems_cd_until    timestamptz,
  gems_today_day   date,
  gems_today_count integer not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.ad_reward_state enable row level security;
revoke all on public.ad_reward_state from public, anon, authenticated;
grant all on public.ad_reward_state to service_role;

-- Update `_luck_of` so server-side rolls reflect active x3 Ad Luck
create or replace function public._luck_of(p_save jsonb, p_uname text default null)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_player jsonb := coalesce(p_save->'player','{}'::jsonb);
  v_tree   jsonb := coalesce(p_save->'player','{}'::jsonb)->'tree';
  v_base   numeric := coalesce((v_player->>'luckBase')::numeric, (v_player->>'luck')::numeric, 1);
  v_flat   numeric := coalesce((v_player->>'luckFlat')::numeric, 0);
  v_pct    numeric := coalesce((v_player->>'luckPercent')::numeric, 0);
  v_tf     numeric; v_tp numeric;
  v_af     numeric; v_ap numeric;
  v_pf     numeric; v_pp numeric;
  v_aw     text;
  v_wmult  numeric := 1;
  v_gmult  numeric := 1;
  v_rb_cnt integer := 0;
  v_rmult  numeric := 1;
  v_amult  numeric := 1;
  v_pmult  numeric := 1;
begin
  select coalesce(sum(flat),0), coalesce(sum(pct),0) into v_tf, v_tp
    from public.luck_def
   where kind='tree' and coalesce((v_tree->>id) in ('true','1'), false);
  v_flat := v_flat + v_tf; v_pct := v_pct + v_tp;

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_af, v_ap
    from jsonb_array_elements_text(coalesce(p_save->'artSlots','[]'::jsonb)) as slot_id
    join public.luck_def ld on ld.kind='art' and ld.id = slot_id
   where slot_id is not null;
  v_flat := v_flat + coalesce(v_af,0); v_pct := v_pct + coalesce(v_ap,0);

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_pf, v_pp
    from public.luck_def ld
   where ld.kind='pet' and ld.id = nullif(p_save->>'petEquipped','');
  v_flat := v_flat + coalesce(v_pf,0); v_pct := v_pct + coalesce(v_pp,0);

  if v_pct < -0.99 then v_pct := -0.99; end if;

  if p_save->'weather' is not null
     and coalesce((p_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint then
    v_aw := p_save->'weather'->>'id';
    select coalesce(mult,1) into v_wmult from public.luck_def where kind='weather' and id = v_aw;
    v_wmult := coalesce(v_wmult,1);
  end if;

  select coalesce(multiplier,1) into v_gmult
    from public.global_luck where ends_at > now() order by ends_at desc limit 1;
  v_gmult := coalesce(v_gmult,1);

  v_rb_cnt := greatest(0, coalesce((p_save->'rebirth'->>'count')::integer, 0));
  v_rmult  := case when v_rb_cnt <= 0 then 1 else v_rb_cnt * 5 end;

  if p_uname is not null and exists (
    select 1 from public.ad_reward_state a
     where a.username = p_uname and a.luck_ends_at > now()
  ) then
    v_amult := 2;
  end if;

  v_pmult := public._pass_luck_mult(p_uname);

  return greatest(1, (v_base + v_flat) * (1 + v_pct) * v_wmult * v_gmult * v_rmult * v_amult * v_pmult);
end;
$$;

-- Read current Watch Ads timers for authenticated user
create or replace function public.get_ad_reward_state()
returns jsonb
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  c_gems_cap constant integer := 40;
  v_uid   uuid := auth.uid();
  v_uname text;
  v_st    public.ad_reward_state%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_now   timestamptz := now();
  v_cnt   integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select * into v_st from public.ad_reward_state where username = v_uname;
  if found and v_st.gems_today_day = v_today then
    v_cnt := coalesce(v_st.gems_today_count, 0);
  end if;

  return jsonb_build_object(
    'ok', true,
    'luckEndsAtMs', case when found and v_st.luck_ends_at is not null and v_st.luck_ends_at > v_now
                         then (extract(epoch from v_st.luck_ends_at)*1000)::bigint else 0 end,
    'packCdEndsAtMs', case when found and v_st.pack_cd_ends_at is not null and v_st.pack_cd_ends_at > v_now
                           then (extract(epoch from v_st.pack_cd_ends_at)*1000)::bigint else 0 end,
    'gemsCdUntilMs', case when found and v_st.gems_cd_until is not null and v_st.gems_cd_until > v_now
                          then (extract(epoch from v_st.gems_cd_until)*1000)::bigint else 0 end,
    'gemsTodayCount', v_cnt,
    'gemsTodayCap', c_gems_cap,
    'serverNowMs', (extract(epoch from v_now)*1000)::bigint
  );
end;
$$;

-- Claim a Watch Ads reward authoritatively
create or replace function public.claim_ad_reward(
  p_kind text,
  p_luck numeric default null
)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $fn$
declare
  c_gems_gain constant integer  := 25;
  c_gems_cd   constant interval := interval '15 seconds';
  c_gems_cap  constant integer  := 40;
  c_luck_dur  constant interval := interval '5 minutes';
  c_pack_cd   constant interval := interval '30 minutes';

  v_uid        uuid := auth.uid();
  v_uname      text;
  v_st         public.ad_reward_state%rowtype;
  v_now        timestamptz := now();
  v_today      date := (v_now at time zone 'utc')::date;
  v_cnt        integer := 0;
  v_bal        integer := 0;
  v_luck_end   timestamptz;
  v_luck_ms    bigint;
  v_prev_cd    timestamptz;
  v_pack_end   timestamptz;
  v_pack_ms    bigint;
  v_gems_cd    timestamptz;
  v_roll       jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  insert into public.ad_reward_state (username) values (v_uname)
  on conflict (username) do nothing;

  select * into v_st from public.ad_reward_state where username = v_uname for update;

  if p_kind = 'gems' then
    if v_st.gems_cd_until is not null and v_st.gems_cd_until > v_now then
      return jsonb_build_object(
        'ok', false, 'msg', 'COOLDOWN',
        'cooldownUntilMs', (extract(epoch from v_st.gems_cd_until)*1000)::bigint,
        'serverNowMs', (extract(epoch from v_now)*1000)::bigint
      );
    end if;

    v_cnt := case when v_st.gems_today_day = v_today then coalesce(v_st.gems_today_count, 0) else 0 end;
    if v_cnt >= c_gems_cap then
      return jsonb_build_object(
        'ok', false, 'msg', 'DAILY_CAP',
        'gemsTodayCount', v_cnt, 'gemsTodayCap', c_gems_cap
      );
    end if;

    v_gems_cd := v_now + c_gems_cd;
    update public.ad_reward_state
       set gems_cd_until    = v_gems_cd,
           gems_today_day   = v_today,
           gems_today_count = v_cnt + 1,
           updated_at       = v_now
     where username = v_uname;

    update public.player_saves
       set save_data = jsonb_set(
             coalesce(save_data, '{}'::jsonb),
             '{premiumGems}',
             to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer, 0) + c_gems_gain),
             true
           ),
           updated_at = v_now
     where user_id = v_uid
     returning coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into v_bal;

    insert into public.gem_daily (username, day, total)
    values (v_uname, v_today, c_gems_gain)
    on conflict (username, day) do update
       set total = public.gem_daily.total + excluded.total;

    return jsonb_build_object(
      'ok', true, 'kind', 'gems', 'gain', c_gems_gain, 'balance', v_bal,
      'gemsCdUntilMs', (extract(epoch from v_gems_cd)*1000)::bigint,
      'gemsTodayCount', v_cnt + 1, 'gemsTodayCap', c_gems_cap,
      'serverNowMs', (extract(epoch from v_now)*1000)::bigint
    );

  elsif p_kind = 'luck' then
    if v_st.luck_ends_at is not null and v_st.luck_ends_at > v_now then
      return jsonb_build_object(
        'ok', false, 'msg', 'ALREADY_ACTIVE',
        'luckEndsAtMs', (extract(epoch from v_st.luck_ends_at)*1000)::bigint,
        'serverNowMs', (extract(epoch from v_now)*1000)::bigint
      );
    end if;

    v_luck_end := v_now + c_luck_dur;
    v_luck_ms  := (extract(epoch from v_luck_end)*1000)::bigint;

    update public.ad_reward_state
       set luck_ends_at = v_luck_end,
           updated_at   = v_now
     where username = v_uname;

    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{adLuckEndsAt}', to_jsonb(v_luck_ms), true),
           updated_at = v_now
     where user_id = v_uid;

    return jsonb_build_object(
      'ok', true, 'kind', 'luck',
      'luckEndsAtMs', v_luck_ms,
      'serverNowMs', (extract(epoch from v_now)*1000)::bigint
    );

  elsif p_kind = 'pack100k' then
    if v_st.pack_cd_ends_at is not null and v_st.pack_cd_ends_at > v_now then
      return jsonb_build_object(
        'ok', false, 'msg', 'COOLDOWN',
        'packCdEndsAtMs', (extract(epoch from v_st.pack_cd_ends_at)*1000)::bigint,
        'serverNowMs', (extract(epoch from v_now)*1000)::bigint
      );
    end if;

    v_prev_cd  := v_st.pack_cd_ends_at;
    v_pack_end := v_now + c_pack_cd;
    v_pack_ms  := (extract(epoch from v_pack_end)*1000)::bigint;

    update public.ad_reward_state
       set pack_cd_ends_at = v_pack_end,
           updated_at      = v_now
     where username = v_uname;

    insert into public.player_packs (username, pack, qty)
    values (v_uname, 'r100k', 1)
    on conflict (username, pack) do update
       set qty = public.player_packs.qty + 1;

    v_roll := public.bulk_roll('r100k', 1, p_luck);
    if not coalesce((v_roll->>'ok')::boolean, false) then
      update public.player_packs
         set qty = greatest(0, qty - 1)
       where username = v_uname and pack = 'r100k';
      update public.ad_reward_state
         set pack_cd_ends_at = v_prev_cd,
             updated_at      = v_now
       where username = v_uname;
      return coalesce(v_roll, '{}'::jsonb) || jsonb_build_object('kind', 'pack100k');
    end if;

    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{adPackCdEndsAt}', to_jsonb(v_pack_ms), true),
           updated_at = v_now
     where user_id = v_uid;

    return v_roll || jsonb_build_object(
      'kind', 'pack100k',
      'packCdEndsAtMs', v_pack_ms,
      'serverNowMs', (extract(epoch from v_now)*1000)::bigint
    );

  else
    return jsonb_build_object('ok', false, 'msg', 'UNKNOWN_KIND');
  end if;
end;
$fn$;

revoke all on function public._luck_of(jsonb, text) from public, anon, authenticated;

revoke all on function public.get_ad_reward_state() from public, anon;
grant  execute on function public.get_ad_reward_state() to authenticated, service_role;

revoke all on function public.claim_ad_reward(text, numeric) from public, anon;
grant  execute on function public.claim_ad_reward(text, numeric) to authenticated, service_role;

notify pgrst, 'reload schema';
