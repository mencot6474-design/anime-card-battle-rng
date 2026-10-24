-- ===========================================================
-- WORLD BOSS: total HP pool harian 1T — 2026-10-24
-- Jalankan SETELAH 0005 (dan 0006 kalau sudah).
--
-- Model: setiap hari satu pool HP global (1.000.000.000.000).
-- Satu run menyumbang damage = pct% run x pool, jadi run 100%
-- = 10B. hp_left dipakai bar "sisa HP world boss" di client.
-- Skor leaderboard TETAP pct (0..100) supaya adil antar pemain.
-- ===========================================================

create or replace function public.world_boss_pool_size()
returns bigint
language sql
immutable
as $$
  select 1000000000000::bigint;
$$;

revoke all on function public.world_boss_pool_size() from public;
grant execute on function public.world_boss_pool_size() to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 1) Rotasi harian + inisialisasi/backfill pool
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

  -- Baris lama (sebelum 0007) punya hp_pool 0. Isi pool-nya dan hitung
  -- ulang sisa HP dari attempt yang sudah submit hari itu.
  update public.world_boss_days
     set hp_pool = pool,
         hp_left = greatest(0, pool - coalesce((
           select sum(round(coalesce(a.pct, 0) / 100.0 * pool))
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
-- 2) State client: ikutkan pool
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
  best     numeric := 0;
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
    best := yrow.best_pct;
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
    select bracket, gems, tokens, title
      into ybracket, ygems, ytokens, ytitle
      from public.world_boss_bracket(yrank, ybest);
    select exists(
      select 1 from public.leaderboard_claims
       where period = yper and board = 'world_boss' and username = uname
    ) into yclaimed;

    yjson := jsonb_build_object(
      'period', yper,
      'best_pct', ybest,
      'rank', yrank,
      'total_players', ytotal,
      'bracket', ybracket,
      'gems', ygems,
      'tokens', ytokens,
      'title', ytitle,
      'claimed', yclaimed,
      'claimable', (not yclaimed) and (ytokens > 0)
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
    'best_pct', best,
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
-- 3) Submit: potong pool harian
-- -----------------------------------------------------------
create or replace function public.submit_world_boss_run(
  p_username text,
  p_password_hash text,
  p_pct numeric,
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
  best       numeric;
  s_val      numeric;
  s_upd      timestamptz;
  my_rank    integer;
  info       public.world_boss_days;
  pool       bigint;
  dmg        bigint;
  left_hp    bigint;
begin
  if p_username is null or p_run_id is null or p_pct is null then
    raise exception 'BAD_INPUT';
  end if;
  if p_pct < 0 or p_pct > 100 then
    raise exception 'BAD_PCT';
  end if;

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

  p_pct := round(p_pct, 2);

  info := public.world_boss_day_info();
  pool := info.hp_pool;
  dmg := round(p_pct / 100.0 * pool)::bigint;

  update public.world_boss_days
     set hp_left = greatest(0, hp_left - dmg)
   where day = today
   returning hp_left into left_hp;

  update public.world_boss_attempts
     set submitted_at = now(), pct = p_pct
   where id = a.id;

  update public.world_boss_runs
     set best_pct = greatest(best_pct, p_pct), updated_at = now()
   where day = today and username = uname
  returning attempts, best_pct into used, best;

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
    'pct', p_pct,
    'best_pct', best,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'rank', my_rank,
    'period', per,
    'pool_dmg', dmg,
    'hp_pool', pool,
    'hp_left', coalesce(left_hp, 0)
  );
end;
$$;

revoke all on function public.submit_world_boss_run(text, text, numeric, bigint) from public;
grant execute on function public.submit_world_boss_run(text, text, numeric, bigint) to anon, authenticated, service_role;
