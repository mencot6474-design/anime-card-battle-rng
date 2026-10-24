-- ===========================================================
-- WORLD BOSS MULTI-POOL — 2 boss (Eternal Dragon + Shadow King)
-- Jalankan SETELAH 0008 di Supabase SQL Editor.
--
-- Perubahan:
--   * Board baru 'world_boss_b' — papan terpisah untuk Shadow King.
--   * world_boss_days / world_boss_runs / world_boss_attempts dapat boss_id.
--   * Semua RPC World Boss dapat param p_boss (default RAID_ETERNAL_DRAGON),
--     jadi pemanggil lama (2 argumen) tetap jalan tanpa diubah.
--   * Attempt, pool HP, rank, dan reward dihitung TERPISAH per boss.
--     (3 attempt/hari untuk masing-masing boss.)
--
-- Model keamanan sama seperti 0005/0008: SECURITY DEFINER + verifikasi
-- password hash, tabel di-REVOKE dari anon/authenticated (RPC-only).
-- ===========================================================

-- -----------------------------------------------------------
-- 1) Drop signature lama (tanpa p_boss) supaya tidak ambigu
--    f(a,b) vs f(a,b,c default) = "function is not unique".
-- -----------------------------------------------------------
drop function if exists public.world_boss_day_info(date);
drop function if exists public.world_boss_state(text, text);
drop function if exists public.start_world_boss_run(text, text);
drop function if exists public.submit_world_boss_run(text, text, bigint, bigint);
drop function if exists public.claim_world_boss_reward(text, text);
drop function if exists public.get_leaderboard(text, text, integer, text);

-- -----------------------------------------------------------
-- 2) Board baru di leaderboard_scores
-- -----------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.leaderboard_scores'::regclass
       and contype  = 'c'
       and pg_get_constraintdef(oid) ilike '%world_boss%'
  loop
    execute format('alter table public.leaderboard_scores drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.leaderboard_scores
  add constraint leaderboard_scores_board_check
  check (board in ('world_boss','world_boss_b','inf_tower','deck_power','rarest_pull'));

-- -----------------------------------------------------------
-- 3) boss_id di tabel harian + primary key baru
-- -----------------------------------------------------------
alter table public.world_boss_days
  add column if not exists boss_id text not null default 'RAID_ETERNAL_DRAGON';

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.world_boss_days'::regclass
       and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (day)'
  ) then
    alter table public.world_boss_days drop constraint world_boss_days_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.world_boss_days'::regclass
       and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (day, boss_id)'
  ) then
    alter table public.world_boss_days
      add constraint world_boss_days_pkey primary key (day, boss_id);
  end if;
end $$;

alter table public.world_boss_runs
  add column if not exists boss_id text not null default 'RAID_ETERNAL_DRAGON';

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.world_boss_runs'::regclass
       and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (day, username)'
  ) then
    alter table public.world_boss_runs drop constraint world_boss_runs_pkey;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.world_boss_runs'::regclass
       and contype = 'p'
       and pg_get_constraintdef(oid) = 'PRIMARY KEY (day, boss_id, username)'
  ) then
    alter table public.world_boss_runs
      add constraint world_boss_runs_pkey primary key (day, boss_id, username);
  end if;
end $$;

alter table public.world_boss_attempts
  add column if not exists boss_id text not null default 'RAID_ETERNAL_DRAGON';

create index if not exists wb_attempts_boss_idx
  on public.world_boss_attempts (day, boss_id, username);

-- Tabel tetap RPC-only (idempotent, jaga-jaga kalau ada grant liar).
revoke all on public.world_boss_days     from anon, authenticated;
revoke all on public.world_boss_runs     from anon, authenticated;
revoke all on public.world_boss_attempts from anon, authenticated;

-- -----------------------------------------------------------
-- 4) Rotasi harian PER BOSS (pool 1T masing-masing)
--    hp_left dihitung ulang dari total damage submit boss itu.
-- -----------------------------------------------------------
create or replace function public.world_boss_day_info(
  p_day  date default null,
  p_boss text default 'RAID_ETERNAL_DRAGON'
)
returns public.world_boss_days
language plpgsql
security definer
set search_path = public
as $$
declare
  d    date := coalesce(p_day, public.lb_day());
  boss text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  mods jsonb[] := array[
    '{"label":"CLEAR SKY","hp_pct":0,"atk_pct":0}'::jsonb,
    '{"label":"IRON HIDE","hp_pct":25,"atk_pct":0}'::jsonb,
    '{"label":"OVERCLOCK","hp_pct":0,"atk_pct":20}'::jsonb,
    '{"label":"FRENZY","hp_pct":-15,"atk_pct":30}'::jsonb,
    '{"label":"ECLIPSE","hp_pct":15,"atk_pct":15}'::jsonb
  ];
  boff integer;
  moff integer;
  pool bigint := public.world_boss_pool_size();
  rec  public.world_boss_days;
begin
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  -- Modifier beda per boss supaya dua pool tidak terasa sama.
  boff := case boss when 'RAID_SHADOW_KING' then 2 else 0 end;
  moff := (((d - date '2026-01-01') + boff) % array_length(mods, 1) + array_length(mods, 1))
          % array_length(mods, 1);

  insert into public.world_boss_days (day, boss_id, modifier, hp_pool, hp_left)
  values (d, boss, mods[1 + moff], pool, pool)
  on conflict (day, boss_id) do nothing;

  -- Baris lama / migrasi: hitung ulang sisa pool dari damage yang sudah submit.
  update public.world_boss_days
     set hp_pool = pool,
         hp_left = greatest(0, pool - coalesce((
           select sum(coalesce(a.dmg, 0))
             from public.world_boss_attempts a
            where a.day = d and a.boss_id = boss and a.submitted_at is not null
         ), 0))
   where day = d and boss_id = boss and hp_pool is distinct from pool;

  select * into rec from public.world_boss_days where day = d and boss_id = boss;
  return rec;
end;
$$;

revoke all on function public.world_boss_day_info(date, text) from public;
grant execute on function public.world_boss_day_info(date, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 5) State client per boss (attempt, best_dmg, rank, reward kemarin)
-- -----------------------------------------------------------
create or replace function public.world_boss_state(
  p_username      text,
  p_password_hash text,
  p_boss          text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(p_username);
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
  stored_pw text;
  info      public.world_boss_days;
  used      integer := 0;
  best      bigint := 0;
  best_p    numeric := 0;
  total     integer := 0;
  my_rank   integer;
  yper      text := to_char(public.lb_day() - 1, 'YYYY-MM-DD');
  ybest     numeric;
  yrank     integer;
  ytotal    integer;
  ybracket  text;
  ygems     integer;
  ytokens   integer;
  ypacks    integer;
  ytitle    text;
  yclaimed  boolean := false;
  yrow      public.world_boss_runs;
  yjson     jsonb;
  top8      jsonb;
begin
  if p_username is null then
    raise exception 'BAD_INPUT';
  end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

  select password into stored_pw
    from public.player_saves where username = uname;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  info := public.world_boss_day_info(null, boss);

  select * into yrow from public.world_boss_runs
   where day = public.lb_day() and boss_id = boss and username = uname;

  if found then
    used   := yrow.attempts;
    best   := yrow.best_dmg;
    best_p := yrow.best_pct;
  end if;

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

  -- Reward kemarin (papan boss ini saja)
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
    'rank', my_rank,
    'total_players', total,
    'top', top8,
    'yesterday', yjson
  );
end;
$$;

revoke all on function public.world_boss_state(text, text, text) from public;
grant execute on function public.world_boss_state(text, text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 6) Mulai run (memotong 1 attempt boss itu)
-- -----------------------------------------------------------
create or replace function public.start_world_boss_run(
  p_username      text,
  p_password_hash text,
  p_boss          text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(p_username);
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  stored_pw text;
  today     date := public.lb_day();
  info      public.world_boss_days;
  used      integer;
  run_id    bigint;
begin
  if p_username is null then
    raise exception 'BAD_INPUT';
  end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  select password into stored_pw
    from public.player_saves where username = uname;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  info := public.world_boss_day_info(null, boss);

  insert into public.world_boss_runs (day, boss_id, username)
  values (today, boss, uname)
  on conflict (day, boss_id, username) do nothing;

  select attempts into used
    from public.world_boss_runs
   where day = today and boss_id = boss and username = uname
   for update;

  if coalesce(used, 0) >= 3 then
    return jsonb_build_object('ok', false, 'msg', 'NO_ATTEMPTS_LEFT',
                              'boss_id', boss, 'attempts_left', 0, 'day', today);
  end if;

  insert into public.world_boss_attempts (day, boss_id, username)
  values (today, boss, uname)
  returning id into run_id;

  update public.world_boss_runs
     set attempts = attempts + 1, updated_at = now()
   where day = today and boss_id = boss and username = uname;

  return jsonb_build_object(
    'ok', true,
    'run_id', run_id,
    'day', today,
    'boss_id', boss,
    'modifier', info.modifier,
    'attempts_left', 3 - (coalesce(used, 0) + 1)
  );
end;
$$;

revoke all on function public.start_world_boss_run(text, text, text) from public;
grant execute on function public.start_world_boss_run(text, text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 7) Submit damage run (absolut) — pool boss itu yang terkikis
-- -----------------------------------------------------------
create or replace function public.submit_world_boss_run(
  p_username      text,
  p_password_hash text,
  p_dmg           bigint,
  p_run_id        bigint,
  p_boss          text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(p_username);
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
  stored_pw text;
  today     date := public.lb_day();
  per       text := public.lb_period(true);
  a         public.world_boss_attempts%rowtype;
  used      integer;
  best      bigint;
  best_p    numeric;
  s_val     numeric;
  s_upd     timestamptz;
  my_rank   integer;
  info      public.world_boss_days;
  pool      bigint;
  dmg_in    bigint;
  left_hp   bigint;
  pct_v     numeric;
begin
  if p_username is null or p_run_id is null or p_dmg is null then
    raise exception 'BAD_INPUT';
  end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

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
    'pct', pct_v,
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

revoke all on function public.submit_world_boss_run(text, text, bigint, bigint, text) from public;
grant execute on function public.submit_world_boss_run(text, text, bigint, bigint, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 8) Klaim reward harian (skor KEMARIN, papan boss itu)
--    Reward tiap boss diklaim terpisah (leaderboard_claims per board).
-- -----------------------------------------------------------
create or replace function public.claim_world_boss_reward(
  p_username      text,
  p_password_hash text,
  p_boss          text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(p_username);
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
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
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

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
   where period = yper and board = brd and username = uname;

  if ybest is null then
    return jsonb_build_object('ok', false, 'msg', 'NO_SCORE', 'period', yper, 'boss_id', boss);
  end if;

  yrank := public.lb_rank(yper, brd, ybest, yupd);
  select count(*) into ytotal
    from public.leaderboard_scores where period = yper and board = brd;

  select * into br from public.world_boss_bracket(yrank, ybest::bigint);

  insert into public.leaderboard_claims (period, board, username, bracket, gems, tokens, packs, title)
  values (yper, brd, uname, br.bracket, br.gems, br.tokens, coalesce(br.packs, 0), br.title)
  on conflict (period, board, username) do nothing
  returning * into claimrow;

  if claimrow is null then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_CLAIMED', 'period', yper, 'boss_id', boss);
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
    'boss_id', boss,
    'board', brd,
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

revoke all on function public.claim_world_boss_reward(text, text, text) from public;
grant execute on function public.claim_world_boss_reward(text, text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 9) Leaderboard (read-only) — board world_boss_b ikut daily
-- -----------------------------------------------------------
create or replace function public.get_leaderboard(
  p_board    text,
  p_period   text default null,
  p_limit    integer default 100,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  per   text;
  lim   integer;
  rows  jsonb;
  total integer;
  me    jsonb;
begin
  if p_board is null or p_board not in
     ('world_boss','world_boss_b','inf_tower','deck_power','rarest_pull') then
    raise exception 'BAD_BOARD';
  end if;

  per := coalesce(nullif(p_period, ''),
                  public.lb_period(p_board in ('world_boss','world_boss_b')));
  lim := greatest(1, least(coalesce(p_limit, 100), 500));

  select count(*) into total
    from public.leaderboard_scores
   where period = per and board = p_board;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', t.rn, 'username', t.username, 'value', t.value,
           'meta', t.meta, 'updated_at', t.updated_at) order by t.rn), '[]'::jsonb)
    into rows
    from (
      select row_number() over (order by value desc, updated_at asc) as rn,
             username, value, meta, updated_at
        from public.leaderboard_scores
       where period = per and board = p_board
       order by value desc, updated_at asc
       limit lim
    ) t;

  if p_username is not null then
    select jsonb_build_object(
             'rank', public.lb_rank(per, p_board, s.value, s.updated_at),
             'value', s.value,
             'updated_at', s.updated_at)
      into me
      from public.leaderboard_scores s
     where s.period = per and s.board = p_board and s.username = lower(p_username);
  end if;

  return jsonb_build_object(
    'ok', true,
    'board', p_board,
    'period', per,
    'rows', rows,
    'total_players', total,
    'me', me
  );
end;
$$;

revoke all on function public.get_leaderboard(text, text, integer, text) from public;
grant execute on function public.get_leaderboard(text, text, integer, text) to anon, authenticated, service_role;

-- ===========================================================
-- SMOKE TEST (manual di SQL Editor, ganti USERNAME / HASH)
-- ===========================================================
-- Boss A (default, argumen ke-3 boleh dihilangkan):
-- select public.world_boss_state('USERNAME','HASH');
-- select public.start_world_boss_run('USERNAME','HASH');
-- select public.submit_world_boss_run('USERNAME','HASH', 2500000000, <run_id>);
-- select public.claim_world_boss_reward('USERNAME','HASH');
--
-- Boss B (Shadow King):
-- select public.world_boss_state('USERNAME','HASH','RAID_SHADOW_KING');
-- select public.start_world_boss_run('USERNAME','HASH','RAID_SHADOW_KING');
-- select public.submit_world_boss_run('USERNAME','HASH', 2500000000, <run_id>, 'RAID_SHADOW_KING');
-- select public.claim_world_boss_reward('USERNAME','HASH','RAID_SHADOW_KING');
--
-- Papan:
-- select public.get_leaderboard('world_boss',   null, 10, 'USERNAME');
-- select public.get_leaderboard('world_boss_b', null, 10, 'USERNAME');
--
-- Reset uji (boss A / boss B):
-- delete from public.world_boss_attempts where day = public.lb_day() and boss_id = 'RAID_ETERNAL_DRAGON' and username = lower('USERNAME');
-- delete from public.world_boss_runs     where day = public.lb_day() and boss_id = 'RAID_ETERNAL_DRAGON' and username = lower('USERNAME');
-- delete from public.leaderboard_scores  where period = public.lb_period(true) and board = 'world_boss' and username = lower('USERNAME');
-- delete from public.leaderboard_claims  where period = to_char(public.lb_day() - 1, 'YYYY-MM-DD') and board = 'world_boss' and username = lower('USERNAME');






