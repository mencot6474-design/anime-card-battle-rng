-- ============================================================================
-- Migration 0043: World Boss Daily Milestones (7 Tiers per Boss per Day)
-- - Table world_boss_milestone_claims (RLS enabled, no direct client write/read)
-- - world_boss_state: include today's cumulative `total_dmg` and `milestones_claimed`
-- - submit_world_boss_run: preserve 0033 cap, include updated `total_dmg`
-- - claim_world_boss_milestone(p_boss, p_tier): JWT-authenticated atomic claim
--   granting WB Tokens, Gems, Instant Packs (player_packs ledger), and Potions.
-- ============================================================================

create table if not exists public.world_boss_milestone_claims (
  day        date        not null,
  boss_id    text        not null,
  username   text        not null,
  tier       integer     not null check (tier between 1 and 7),
  claimed_at timestamptz not null default now(),
  primary key (day, boss_id, username, tier)
);

alter table public.world_boss_milestone_claims enable row level security;
revoke all on table public.world_boss_milestone_claims from public, anon, authenticated;
grant all on table public.world_boss_milestone_claims to service_role;

create or replace function public.world_boss_state(
  p_boss text default 'RAID_ETERNAL_DRAGON'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  uname      text;
  boss       text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd        text;
  info       public.world_boss_days;
  used       integer := 0;
  best       bigint := 0;
  best_p     numeric := 0;
  v_total_dmg bigint := 0;
  v_claimed  jsonb := '[]'::jsonb;
  total      integer := 0;
  my_rank    integer;
  yper       text := to_char(public.lb_day() - 1, 'YYYY-MM-DD');
  ybest      numeric;
  yrank      integer;
  ytotal     integer;
  ybracket   text;
  ygems      integer;
  ytokens    integer;
  ypacks     integer;
  ytitle     text;
  yclaimed   boolean := false;
  yrow       public.world_boss_runs;
  yjson      jsonb;
  top8       jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

  select username into uname from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  info := public.world_boss_day_info(null, boss);

  select * into yrow from public.world_boss_runs
   where day = public.lb_day() and boss_id = boss and username = uname;

  if found then
    used   := yrow.attempts;
    best   := yrow.best_dmg;
    best_p := yrow.best_pct;
  end if;

  select coalesce(sum(a.dmg), 0)::bigint into v_total_dmg
    from public.world_boss_attempts a
   where a.day = public.lb_day()
     and a.boss_id = boss
     and a.username = uname
     and a.submitted_at is not null;

  select coalesce(jsonb_agg(m.tier order by m.tier), '[]'::jsonb) into v_claimed
    from public.world_boss_milestone_claims m
   where m.day = public.lb_day()
     and m.boss_id = boss
     and m.username = uname;

  select count(*) into total
    from public.leaderboard_scores
   where period = public.lb_period(true) and board = brd;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rn, 'username', t.username, 'value', t.value) order by t.rn), '[]'::jsonb)
    into top8
    from (
      select row_number() over (order by value desc, updated_at asc) as rn,
             username, value
        from public.leaderboard_scores
       where period = public.lb_period(true) and board = brd
       order by value desc, updated_at asc
       limit 8
    ) t;

  if best > 0 then
    select public.lb_rank(public.lb_period(true), brd, value, updated_at)
      into my_rank
      from public.leaderboard_scores
     where period = public.lb_period(true) and board = brd and username = uname;
  end if;

  -- Yesterday reward (this boss board only)
  select s.value, public.lb_rank(yper, brd, s.value, s.updated_at)
    into ybest, yrank
    from public.leaderboard_scores s
   where s.period = yper and s.board = brd and s.username = uname;

  if ybest is not null then
    select count(*) into ytotal
      from public.leaderboard_scores where period = yper and board = brd;

    select bracket, gems, tokens, packs, title
      into ybracket, ygems, ytokens, ypacks, ytitle
      from public.world_boss_bracket(yrank, ybest::bigint);

    select exists(
      select 1 from public.leaderboard_claims
       where period = yper and board = brd and username = uname
    ) into yclaimed;

    yjson := jsonb_build_object(
      'period', yper,
      'best_dmg', ybest::bigint,
      'best_pct', ybest,
      'rank', yrank,
      'total_players', ytotal,
      'bracket', ybracket,
      'gems', ygems,
      'tokens', ytokens,
      'packs', coalesce(ypacks, 0),
      'title', ytitle,
      'claimed', yclaimed,
      'claimable', (not yclaimed) and (coalesce(ygems, 0) > 0 or coalesce(ytokens, 0) > 0)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'day', info.day,
    'boss_id', boss,
    'board', brd,
    'modifier', info.modifier,
    'hp_pool', info.hp_pool,
    'hp_left', info.hp_left,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'best_dmg', best,
    'best_pct', best_p,
    'total_dmg', v_total_dmg,
    'milestones_claimed', v_claimed,
    'rank', my_rank,
    'total_players', total,
    'top', top8,
    'yesterday', yjson
  );
end;
$function$;

create or replace function public.submit_world_boss_run(
  p_dmg bigint,
  p_run_id bigint,
  p_boss text default 'RAID_ETERNAL_DRAGON'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  uname       text;
  boss        text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd         text;
  today       date := public.lb_day();
  per         text := public.lb_period(true);
  a           public.world_boss_attempts%rowtype;
  used        integer;
  best        bigint;
  best_p      numeric;
  v_total_dmg bigint := 0;
  s_val       numeric;
  s_upd       timestamptz;
  my_rank     integer;
  info        public.world_boss_days;
  pool        bigint;
  dmg_in      bigint;
  dmg_raw     bigint;
  dmg_cap     bigint;
  save        jsonb;
  left_hp     bigint;
  pct_v       numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_run_id is null or p_dmg is null then
    raise exception 'BAD_INPUT';
  end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

  select username, save_data into uname, save
    from public.player_saves where user_id = v_uid limit 1;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  dmg_raw := greatest(0, coalesce(p_dmg, 0));
  dmg_cap := public._wb_dmg_cap(save);
  dmg_in  := least(dmg_raw, dmg_cap, public.world_boss_pool_size());

  select * into a
    from public.world_boss_attempts
   where id = p_run_id and username = uname and day = today and boss_id = boss
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'RUN_NOT_FOUND');
  end if;
  if a.submitted_at is not null then
    return jsonb_build_object('ok', false, 'msg', 'RUN_ALREADY_SUBMITTED');
  end if;

  info := public.world_boss_day_info(null, boss);
  pool  := info.hp_pool;
  pct_v := case when pool > 0 then round(dmg_in::numeric / pool * 100, 4) else 0 end;

  update public.world_boss_days
     set hp_left = greatest(0, hp_left - dmg_in)
   where day = today and boss_id = boss
   returning hp_left into left_hp;

  update public.world_boss_attempts
     set submitted_at = now(), dmg = dmg_in, pct = least(100, pct_v)
   where id = a.id;

  select coalesce(sum(att.dmg), 0)::bigint into v_total_dmg
    from public.world_boss_attempts att
   where att.day = today
     and att.boss_id = boss
     and att.username = uname
     and att.submitted_at is not null;

  update public.world_boss_runs
     set best_dmg = greatest(best_dmg, dmg_in),
         best_pct = greatest(best_pct, least(100, pct_v)),
         updated_at = now()
   where day = today and boss_id = boss and username = uname
   returning attempts, best_dmg, best_pct into used, best, best_p;

  if used is null then
    return jsonb_build_object('ok', false, 'msg', 'RUN_NOT_FOUND');
  end if;

  insert into public.leaderboard_scores (period, board, username, value, meta, updated_at)
  values (per, brd, uname, best,
          jsonb_build_object('boss_id', boss, 'day', info.day), now())
  on conflict (period, board, username) do update
    set value = excluded.value,
        meta = excluded.meta,
        updated_at = now()
    where public.leaderboard_scores.value < excluded.value;

  select value, updated_at into s_val, s_upd
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  my_rank := public.lb_rank(per, brd, s_val, s_upd);

  return jsonb_build_object(
    'ok', true,
    'boss_id', boss,
    'board', brd,
    'dmg', dmg_in,
    'dmg_cap', dmg_cap,
    'dmg_capped', dmg_raw > dmg_in,
    'pct', pct_v,
    'best_dmg', best,
    'best_pct', best_p,
    'total_dmg', v_total_dmg,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'rank', my_rank,
    'period', per,
    'pool_dmg', dmg_in,
    'hp_pool', pool,
    'hp_left', coalesce(left_hp, 0)
  );
end;
$function$;

create or replace function public.claim_world_boss_milestone(
  p_boss text default 'RAID_ETERNAL_DRAGON'::text,
  p_tier integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c_reqs      constant bigint[] := array[
    25000::bigint,
    100000::bigint,
    500000::bigint,
    2000000::bigint,
    5000000::bigint,
    15000000::bigint,
    40000000::bigint
  ];
  v_uid       uuid := auth.uid();
  uname       text;
  save        jsonb;
  new_save    jsonb;
  boss        text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  today       date := public.lb_day();
  v_req       bigint;
  v_total_dmg bigint := 0;
  v_ins       integer;
  v_tok       integer := 0;
  v_gems      integer := 0;
  v_pack      text := null;
  v_pack_qty  integer := 0;
  v_luck1     integer := 0;
  v_luck3     integer := 0;
  v_speed3    integer := 0;
  tok_new     integer;
  gems_new    integer;
  v_lp        integer[];
  v_sp        integer[];
  v_i         integer;
  v_raw       text;
  v_claimed   jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;
  if p_tier is null or p_tier < 1 or p_tier > 7 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_TIER');
  end if;

  select username, save_data into uname, save
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  v_req := c_reqs[p_tier];

  select coalesce(sum(a.dmg), 0)::bigint into v_total_dmg
    from public.world_boss_attempts a
   where a.day = today
     and a.boss_id = boss
     and a.username = uname
     and a.submitted_at is not null;

  if v_total_dmg < v_req then
    return jsonb_build_object(
      'ok', false,
      'msg', 'NOT_REACHED',
      'tier', p_tier,
      'total_dmg', v_total_dmg,
      'req', v_req
    );
  end if;

  insert into public.world_boss_milestone_claims (day, boss_id, username, tier)
  values (today, boss, uname, p_tier)
  on conflict (day, boss_id, username, tier) do nothing
  returning tier into v_ins;

  if v_ins is null then
    return jsonb_build_object(
      'ok', false,
      'msg', 'ALREADY_CLAIMED',
      'tier', p_tier,
      'boss_id', boss
    );
  end if;

  case p_tier
    when 1 then v_tok := 150;  v_luck1 := 2;
    when 2 then v_tok := 300;  v_gems := 25;
    when 3 then v_tok := 500;  v_pack := 'r5k';   v_pack_qty := 2;
    when 4 then v_tok := 850;  v_gems := 50;      v_speed3 := 1;
    when 5 then v_tok := 1250; v_pack := 'r25k';  v_pack_qty := 1;
    when 6 then v_tok := 2000; v_gems := 100;     v_luck3 := 2;
    when 7 then v_tok := 3500; v_gems := 150;     v_pack := 'r100k'; v_pack_qty := 1;
  end case;

  save := coalesce(save, '{}'::jsonb);
  tok_new  := greatest(0, public._int_of(save, 'wbTokens', 0) + v_tok);
  gems_new := greatest(0, public._int_of(save, 'premiumGems', 0) + v_gems);

  v_lp := array[0, 0, 0];
  v_sp := array[0, 0, 0];
  for v_i in 0..2 loop
    v_raw := coalesce(case when jsonb_typeof(save->'luckPots') = 'array' then save->'luckPots'->>v_i else null end, '');
    if v_raw ~ '^[0-9]{1,9}$' then v_lp[v_i + 1] := greatest(0, v_raw::integer); end if;
    v_raw := coalesce(case when jsonb_typeof(save->'speedPots') = 'array' then save->'speedPots'->>v_i else null end, '');
    if v_raw ~ '^[0-9]{1,9}$' then v_sp[v_i + 1] := greatest(0, v_raw::integer); end if;
  end loop;
  v_lp[1] := v_lp[1] + v_luck1;
  v_lp[3] := v_lp[3] + v_luck3;
  v_sp[3] := v_sp[3] + v_speed3;

  new_save := jsonb_set(save, '{wbTokens}', to_jsonb(tok_new), true);
  new_save := jsonb_set(new_save, '{premiumGems}', to_jsonb(gems_new), true);
  new_save := jsonb_set(new_save, '{luckPots}', jsonb_build_array(v_lp[1], v_lp[2], v_lp[3]), true);
  new_save := jsonb_set(new_save, '{speedPots}', jsonb_build_array(v_sp[1], v_sp[2], v_sp[3]), true);

  if v_pack is not null and v_pack_qty > 0 then
    insert into public.player_packs (username, pack, qty)
    values (uname, v_pack, v_pack_qty)
    on conflict (username, pack) do update
      set qty = public.player_packs.qty + excluded.qty;
    new_save := jsonb_set(new_save, '{rollPacks}', public._packs_of(uname), true);
  end if;

  update public.player_saves
     set save_data = new_save,
         updated_at = now()
   where user_id = v_uid;

  select coalesce(jsonb_agg(m.tier order by m.tier), '[]'::jsonb) into v_claimed
    from public.world_boss_milestone_claims m
   where m.day = today
     and m.boss_id = boss
     and m.username = uname;

  return jsonb_build_object(
    'ok', true,
    'boss_id', boss,
    'tier', p_tier,
    'total_dmg', v_total_dmg,
    'tokens', v_tok,
    'gems', v_gems,
    'pack', v_pack,
    'pack_qty', v_pack_qty,
    'luck1', v_luck1,
    'luck3', v_luck3,
    'speed3', v_speed3,
    'wbTokens', tok_new,
    'premiumGems', gems_new,
    'rollPacks', public._packs_of(uname),
    'luckPots', new_save->'luckPots',
    'speedPots', new_save->'speedPots',
    'milestones_claimed', v_claimed
  );
end;
$function$;

revoke all on function public.world_boss_state(text) from public, anon;
grant execute on function public.world_boss_state(text) to authenticated, service_role;

revoke all on function public.submit_world_boss_run(bigint, bigint, text) from public, anon;
grant execute on function public.submit_world_boss_run(bigint, bigint, text) to authenticated, service_role;

revoke all on function public.claim_world_boss_milestone(text, integer) from public, anon;
grant execute on function public.claim_world_boss_milestone(text, integer) to authenticated, service_role;
