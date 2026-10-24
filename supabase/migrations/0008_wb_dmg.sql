-- ===========================================================
-- WORLD BOSS v2 — damage ABSOLUT ke pool 1T, tanpa tier
-- Jalankan SETELAH 0007.
--
-- Perubahan:
--   * Skor = damage mentah run (bigint), bukan persen.
--   * best_dmg = damage TERBAIK 1 run (bukan total).
--   * Reward rank harian baru + PACK 100K untuk rank 1.
--   * Token World Boss (wbTokens) hanya dari klaim reward harian.
-- ===========================================================

-- -----------------------------------------------------------
-- 1) Kolom baru
-- -----------------------------------------------------------
alter table public.world_boss_attempts add column if not exists dmg bigint not null default 0;
alter table public.world_boss_runs     add column if not exists best_dmg bigint not null default 0;
alter table public.leaderboard_claims  add column if not exists packs integer not null default 0;

-- -----------------------------------------------------------
-- 2) Rotasi harian: backfill pool pakai dmg (bukan pct)
-- -----------------------------------------------------------
create or replace function public.world_boss_day_info(p_day date default null)
returns public.world_boss_days
language plpgsql
security definer
set search_path = public
as $$
declare
  d       date := coalesce(p_day, public.lb_day());
  bosses  text[] := array['RAID_ETERNAL_DRAGON'];
  mods    jsonb[] := array[
    '{"label":"CLEAR SKY","hp_pct":0,"atk_pct":0}'::jsonb,
    '{"label":"IRON HIDE","hp_pct":25,"atk_pct":0}'::jsonb,
    '{"label":"OVERCLOCK","hp_pct":0,"atk_pct":20}'::jsonb,
    '{"label":"FRENZY","hp_pct":-15,"atk_pct":30}'::jsonb,
    '{"label":"ECLIPSE","hp_pct":15,"atk_pct":15}'::jsonb
  ];
  off     integer;
  pool    bigint := public.world_boss_pool_size();
  rec     public.world_boss_days;
begin
  off := ((d - date '2026-01-01') % array_length(bosses, 1) + array_length(bosses, 1)) % array_length(bosses, 1);

  insert into public.world_boss_days (day, boss_id, modifier, hp_pool, hp_left)
  values (
    d,
    bosses[1 + off],
    mods[1 + (((d - date '2026-01-01') % array_length(mods, 1) + array_length(mods, 1)) % array_length(mods, 1))],
    pool,
    pool
  )
  on conflict (day) do nothing;

  -- Baris lama / migrasi: hitung ulang sisa pool dari damage yang sudah submit.
  update public.world_boss_days
     set hp_pool = pool,
         hp_left = greatest(0, pool - coalesce((
           select sum(coalesce(a.dmg, 0))
             from public.world_boss_attempts a
            where a.day = d and a.submitted_at is not null
         ), 0))
   where day = d and hp_pool is distinct from pool;

  select * into rec from public.world_boss_days where day = d;
  return rec;
end;
$$;

revoke all on function public.world_boss_day_info(date) from public;
grant execute on function public.world_boss_day_info(date) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 3) Bracket reward harian (rank kemarin)
--    Participant = damage terbaik >= 1.000.000.000 (1B)
-- -----------------------------------------------------------
drop function if exists public.world_boss_bracket(integer, numeric);

create or replace function public.world_boss_bracket(p_rank integer, p_best bigint)
returns table (bracket text, gems integer, tokens integer, packs integer, title text)
language sql
immutable
as $$
  select
    case
      when p_rank is null then 'none'
      when p_rank = 1     then 'rank1'
      when p_rank = 2     then 'rank2'
      when p_rank = 3     then 'rank3'
      when p_rank <= 10   then 'rank4_10'
      when p_rank <= 50   then 'rank11_50'
      when p_rank <= 200  then 'rank51_200'
      when coalesce(p_best, 0) >= 1000000000 then 'participant'
      else 'none'
    end,
    case
      when p_rank = 1     then 1000
      when p_rank = 2     then 500
      when p_rank = 3     then 250
      when p_rank <= 10   then 100
      when p_rank <= 200  then 100
      when coalesce(p_best, 0) >= 1000000000 then 100
      else 0
    end,
    case
      when p_rank = 1     then 10000
      when p_rank <= 10   then 3000
      when p_rank <= 50   then 1500
      when p_rank <= 200  then 700
      when coalesce(p_best, 0) >= 1000000000 then 300
      else 0
    end,
    case when p_rank = 1 then 10 else 0 end,
    case when p_rank = 1 then 'APEX SLAYER' else null end;
$$;

revoke all on function public.world_boss_bracket(integer, bigint) from public;

-- -----------------------------------------------------------
-- 4) Submit damage run (absolut)
-- -----------------------------------------------------------
drop function if exists public.submit_world_boss_run(text, text, numeric, bigint);

create or replace function public.submit_world_boss_run(
  p_username text,
  p_password_hash text,
  p_dmg bigint,
  p_run_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname      text := lower(p_username);
  stored_pw  text;
  today      date := public.lb_day();
  per        text := public.lb_period(true);
  a          public.world_boss_attempts%rowtype;
  used       integer;
  best       bigint;
  best_p     numeric;
  s_val      numeric;
  s_upd      timestamptz;
  my_rank    integer;
  info       public.world_boss_days;
  pool       bigint;
  dmg_in     bigint;
  left_hp    bigint;
  pct        numeric;
begin
  if p_username is null or p_run_id is null or p_dmg is null then
    raise exception 'BAD_INPUT';
  end if;

  dmg_in := greatest(0, least(coalesce(p_dmg, 0), public.world_boss_pool_size()));

  select password into stored_pw
    from public.player_saves where username = uname;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  select * into a
    from public.world_boss_attempts
   where id = p_run_id and username = uname and day = today
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'RUN_NOT_FOUND');
  end if;
  if a.submitted_at is not null then
    return jsonb_build_object('ok', false, 'msg', 'RUN_ALREADY_SUBMITTED');
  end if;

  info := public.world_boss_day_info();
  pool := info.hp_pool;
  pct  := case when pool > 0 then round(dmg_in::numeric / pool * 100, 4) else 0 end;

  update public.world_boss_days
     set hp_left = greatest(0, hp_left - dmg_in)
   where day = today
   returning hp_left into left_hp;

  update public.world_boss_attempts
     set submitted_at = now(), dmg = dmg_in, pct = least(100, pct)
   where id = a.id;

  update public.world_boss_runs
     set best_dmg = greatest(best_dmg, dmg_in),
         best_pct = greatest(best_pct, least(100, pct)),
         updated_at = now()
   where day = today and username = uname
   returning attempts, best_dmg, best_pct into used, best, best_p;

  if used is null then
    return jsonb_build_object('ok', false, 'msg', 'RUN_NOT_FOUND');
  end if;

  insert into public.leaderboard_scores (period, board, username, value, meta, updated_at)
  values (per, 'world_boss', uname, best,
          jsonb_build_object('boss_id', info.boss_id, 'day', info.day), now())
  on conflict (period, board, username) do update
    set value = excluded.value,
        meta = excluded.meta,
        updated_at = now()
    where public.leaderboard_scores.value < excluded.value;

  select value, updated_at into s_val, s_upd
    from public.leaderboard_scores
   where period = per and board = 'world_boss' and username = uname;

  my_rank := public.lb_rank(per, 'world_boss', s_val, s_upd);

  return jsonb_build_object(
    'ok', true,
    'dmg', dmg_in,
    'pct', pct,
    'best_dmg', best,
    'best_pct', best_p,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'rank', my_rank,
    'period', per,
    'pool_dmg', dmg_in,
    'hp_pool', pool,
    'hp_left', coalesce(left_hp, 0)
  );
end;
$$;

-- -----------------------------------------------------------
-- 5) State client (best_dmg + reward kemarin termasuk pack)
-- -----------------------------------------------------------
create or replace function public.world_boss_state(
  p_username text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname    text := lower(p_username);
  stored_pw text;
  info     public.world_boss_days;
  used     integer := 0;
  best     bigint := 0;
  best_p   numeric := 0;
  total    integer := 0;
  my_rank  integer;
  yday     date := public.lb_day() - 1;
  yper     text;
  ybest    numeric;
  yrank    integer;
  ytotal   integer;
  ybracket text;
  ygems    integer;
  ytokens  integer;
  ypacks   integer;
  ytitle   text;
  yclaimed boolean := false;
  yrow     public.world_boss_runs;
  yjson    jsonb;
  top3     jsonb;
begin
  if p_username is null then
    raise exception 'BAD_INPUT';
  end if;

  select password into stored_pw
    from public.player_saves where username = uname;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  info := public.world_boss_day_info();

  select * into yrow from public.world_boss_runs
   where day = public.lb_day() and username = uname;

  if found then
    used := yrow.attempts;
    best := yrow.best_dmg;
    best_p := yrow.best_pct;
  end if;

  select count(*) into total
    from public.leaderboard_scores
   where period = public.lb_period(true) and board = 'world_boss';

  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rn, 'username', t.username, 'value', t.value) order by t.rn), '[]'::jsonb)
    into top3
    from (
      select row_number() over (order by value desc, updated_at asc) as rn,
             username, value
        from public.leaderboard_scores
       where period = public.lb_period(true) and board = 'world_boss'
       order by value desc, updated_at asc
       limit 8
    ) t;

  if best > 0 then
    select public.lb_rank(public.lb_period(true), 'world_boss', value, updated_at)
      into my_rank
      from public.leaderboard_scores
     where period = public.lb_period(true) and board = 'world_boss' and username = uname;
  end if;

  -- Reward kemarin
  yper := to_char(yday, 'YYYY-MM-DD');

  select s.value, public.lb_rank(yper, 'world_boss', s.value, s.updated_at)
    into ybest, yrank
    from public.leaderboard_scores s
   where s.period = yper and s.board = 'world_boss' and s.username = uname;

  if ybest is not null then
    select count(*) into ytotal from public.leaderboard_scores where period = yper and board = 'world_boss';
    select bracket, gems, tokens, packs, title
      into ybracket, ygems, ytokens, ypacks, ytitle
      from public.world_boss_bracket(yrank, ybest::bigint);
    select exists(
      select 1 from public.leaderboard_claims
       where period = yper and board = 'world_boss' and username = uname
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
    'boss_id', info.boss_id,
    'modifier', info.modifier,
    'hp_pool', info.hp_pool,
    'hp_left', info.hp_left,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'best_dmg', best,
    'best_pct', best_p,
    'rank', my_rank,
    'total_players', total,
    'top', top3,
    'yesterday', yjson
  );
end;
$$;

revoke all on function public.world_boss_state(text, text) from public;
grant execute on function public.world_boss_state(text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 6) Klaim reward harian (skor KEMARIN) — tulis wbTokens + pack
-- -----------------------------------------------------------
create or replace function public.claim_world_boss_reward(
  p_username text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(p_username);
  stored_pw text;
  save      jsonb;
  yper      text := to_char(public.lb_day() - 1, 'YYYY-MM-DD');
  ybest     numeric;
  yupd      timestamptz;
  yrank     integer;
  ytotal    integer;
  br        record;
  claimrow  public.leaderboard_claims%rowtype;
  gems_old  integer;
  tok_old   integer;
  packs_old integer;
  gems_new  integer;
  tok_new   integer;
  titles    jsonb;
  new_save  jsonb;
begin
  if p_username is null then
    raise exception 'BAD_INPUT';
  end if;

  select save_data, password into save, stored_pw
    from public.player_saves
   where username = uname
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  select value, updated_at into ybest, yupd
    from public.leaderboard_scores
   where period = yper and board = 'world_boss' and username = uname;

  if ybest is null then
    return jsonb_build_object('ok', false, 'msg', 'NO_SCORE', 'period', yper);
  end if;

  yrank := public.lb_rank(yper, 'world_boss', ybest, yupd);
  select count(*) into ytotal from public.leaderboard_scores where period = yper and board = 'world_boss';

  select * into br from public.world_boss_bracket(yrank, ybest::bigint);

  insert into public.leaderboard_claims (period, board, username, bracket, gems, tokens, packs, title)
  values (yper, 'world_boss', uname, br.bracket, br.gems, br.tokens, coalesce(br.packs, 0), br.title)
  on conflict (period, board, username) do nothing
  returning * into claimrow;

  if claimrow is null then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_CLAIMED', 'period', yper);
  end if;

  save := coalesce(save, '{}'::jsonb);
  gems_old  := coalesce(nullif(save->>'premiumGems', '')::integer, 0);
  tok_old   := coalesce(nullif(save->>'wbTokens', '')::integer, 0);
  packs_old := coalesce(nullif(save->'rollPacks'->>'r100k', '')::integer, 0);
  gems_new  := gems_old + br.gems;
  tok_new   := tok_old + br.tokens;

  new_save := jsonb_set(save, '{premiumGems}', to_jsonb(gems_new), true);
  new_save := jsonb_set(new_save, '{wbTokens}', to_jsonb(tok_new), true);
  if new_save->'rollPacks' is null then
    new_save := jsonb_set(new_save, '{rollPacks}', '{}'::jsonb, true);
  end if;
  new_save := jsonb_set(new_save, '{rollPacks,r100k}', to_jsonb(packs_old + coalesce(br.packs, 0)), true);
  new_save := new_save - 'raidTokens';

  if br.title is not null then
    titles := coalesce(save->'titles', '[]'::jsonb);
    if not (titles @> to_jsonb(br.title)) then
      titles := titles || to_jsonb(br.title);
    end if;
    new_save := jsonb_set(new_save, '{titles}', titles, true);
  end if;

  update public.player_saves
     set save_data = new_save, updated_at = now()
   where username = uname;

  return jsonb_build_object(
    'ok', true,
    'period', yper,
    'bracket', br.bracket,
    'rank', yrank,
    'total_players', ytotal,
    'gems', br.gems,
    'tokens', br.tokens,
    'packs', coalesce(br.packs, 0),
    'title', br.title,
    'premiumGems', gems_new,
    'wbTokens', tok_new
  );
end;
$$;

revoke all on function public.claim_world_boss_reward(text, text) from public;
grant execute on function public.claim_world_boss_reward(text, text) to anon, authenticated, service_role;

-- ===========================================================
-- SMOKE TEST (manual di SQL Editor, ganti USERNAME / HASH)
-- ===========================================================
-- select public.world_boss_state('USERNAME','HASH');
-- select public.start_world_boss_run('USERNAME','HASH');
-- select public.submit_world_boss_run('USERNAME','HASH', 2500000000, <run_id>);
-- select public.get_leaderboard('world_boss', null, 10, 'USERNAME');
-- select public.claim_world_boss_reward('USERNAME','HASH');
--
-- Reset uji:
-- delete from public.world_boss_attempts where day = public.lb_day() and username = lower('USERNAME');
-- delete from public.world_boss_runs     where day = public.lb_day() and username = lower('USERNAME');
-- delete from public.leaderboard_scores  where period = public.lb_period(true) and board = 'world_boss' and username = lower('USERNAME');
-- delete from public.leaderboard_claims  where period = to_char(public.lb_day() - 1, 'YYYY-MM-DD') and board = 'world_boss' and username = lower('USERNAME');



