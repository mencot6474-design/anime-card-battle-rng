-- ===========================================================
-- WORLD BOSS + LEADERBOARD (server logic) — 2026-10-24
-- Jalankan di Supabase SQL Editor (atau: npx supabase db push).
--
-- Scope file ini: board "world_boss" penuh (attempt 3x/hari, skor,
-- rank, reward harian) + tabel leaderboard generik yang nanti dipakai
-- board INF / Deck Power / Rarest Pull.
--
-- Model keamanan:
--  - Semua RPC SECURITY DEFINER + verifikasi password hash ke
--    player_saves.password (pola yang sama dengan earn_gems).
--  - Tabel di-REVOKE dari anon/authenticated: client hanya boleh
--    lewat RPC, tidak bisa INSERT/UPDATE skor langsung.
--  - Attempt dihitung server: start_world_boss_run() memotong jatah,
--    submit_world_boss_run() hanya melengkapi run yang sudah dimulai.
--    Jadi close-app saat run jelek tetap memakan attempt.
--  - p_pct (damage %) masih dipercaya dari client, sama seperti
--    earn_gems. Reward board ini di-cap (lihat world_boss_bracket),
--    jadi dampak ekonomi terbatas.
-- ===========================================================

-- -----------------------------------------------------------
-- 1) Helper tanggal/periode (WIB)
-- -----------------------------------------------------------
create or replace function public.lb_day()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

create or replace function public.lb_period(p_daily boolean)
returns text
language sql
stable
as $$
  select case when p_daily
    then to_char(public.lb_day(), 'YYYY-MM-DD')
    else to_char(public.lb_day(), 'IYYY-"W"IW')
  end;
$$;

-- -----------------------------------------------------------
-- 2) Tabel
-- -----------------------------------------------------------
create table if not exists public.leaderboard_scores (
  period     text        not null,
  board      text        not null check (board in ('world_boss','inf_tower','deck_power','rarest_pull')),
  username   text        not null,
  value      numeric     not null default 0,
  meta       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (period, board, username)
);
create index if not exists lb_scores_rank_idx
  on public.leaderboard_scores (period, board, value desc, updated_at asc);
create index if not exists lb_scores_user_idx
  on public.leaderboard_scores (username);

create table if not exists public.leaderboard_claims (
  period     text        not null,
  board      text        not null,
  username   text        not null,
  bracket    text        not null,
  gems       integer     not null default 0,
  tokens     integer     not null default 0,
  title      text,
  claimed_at timestamptz not null default now(),
  primary key (period, board, username)
);

create table if not exists public.world_boss_days (
  day       date primary key,
  boss_id   text not null,
  modifier  jsonb not null default '{}'::jsonb,
  hp_pool   bigint not null default 0,
  hp_left   bigint not null default 0
);

create table if not exists public.world_boss_runs (
  day        date    not null,
  username   text    not null,
  attempts   integer not null default 0 check (attempts between 0 and 3),
  best_pct   numeric not null default 0 check (best_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (day, username)
);

-- Ledger per attempt. Baris dibuat saat run DIMULAI (attempt langsung
-- terpakai), lalu dilengkapi saat submit. submitted_at null = run yang
-- ditinggal / masih jalan (tetap memakan attempt).
create table if not exists public.world_boss_attempts (
  id           bigserial primary key,
  day          date not null,
  username     text not null,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  pct          numeric check (pct between 0 and 100)
);
create index if not exists wb_attempts_user_idx
  on public.world_boss_attempts (day, username);

-- -----------------------------------------------------------
-- 3) Kunci akses tabel (RPC-only)
-- -----------------------------------------------------------
alter table public.leaderboard_scores  enable row level security;
alter table public.leaderboard_claims  enable row level security;
alter table public.world_boss_days     enable row level security;
alter table public.world_boss_runs     enable row level security;
alter table public.world_boss_attempts enable row level security;

revoke all on public.leaderboard_scores  from anon, authenticated;
revoke all on public.leaderboard_claims  from anon, authenticated;
revoke all on public.world_boss_days     from anon, authenticated;
revoke all on public.world_boss_runs     from anon, authenticated;
revoke all on public.world_boss_attempts from anon, authenticated;
revoke all on sequence public.world_boss_attempts_id_seq from anon, authenticated;

-- -----------------------------------------------------------
-- 4) Rank & bracket
-- -----------------------------------------------------------
create or replace function public.lb_rank(
  p_period text,
  p_board text,
  p_value numeric,
  p_updated_at timestamptz
)
returns integer
language sql
stable
as $$
  select 1 + count(*)::integer
    from public.leaderboard_scores
   where period = p_period
     and board = p_board
     and (value > p_value or (value = p_value and updated_at < p_updated_at));
$$;

-- Reward World Boss harian. Rank = posisi kemarin.
-- Total GEM maksimum seluruh server per hari: 30 + (9 x 10) = 120.
create or replace function public.world_boss_bracket(p_rank integer, p_best numeric)
returns table (bracket text, gems integer, tokens integer, title text)
language sql
immutable
as $$
  select
    case
      when p_rank is null then 'none'
      when p_rank = 1     then 'rank1'
      when p_rank <= 10   then 'rank2_10'
      when p_rank <= 50   then 'rank11_50'
      when p_rank <= 200  then 'rank51_200'
      when coalesce(p_best, 0) >= 10 then 'participant'
      else 'none'
    end,
    case
      when p_rank = 1     then 30
      when p_rank <= 10   then 10
      else 0
    end,
    case
      when p_rank = 1     then 300
      when p_rank <= 10   then 200
      when p_rank <= 50   then 120
      when p_rank <= 200  then 70
      when coalesce(p_best, 0) >= 10 then 20
      else 0
    end,
    case when p_rank = 1 then 'APEX SLAYER' else null end;
$$;

-- Helper internal (dipanggil RPC definer), jangan diekspos ke client.
revoke all on function public.lb_rank(text, text, numeric, timestamptz) from public;
revoke all on function public.world_boss_bracket(integer, numeric) from public;

-- -----------------------------------------------------------
-- 5) Rotasi harian
-- -----------------------------------------------------------
-- Boss roster sementara cuma satu (RAID_BOSSES di cards-fx.js).
-- Tambah id baru ke array ini saat ada boss World Boss baru.
-- Modifier ikut client: {label, hp_pct, atk_pct}.
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
  rec     public.world_boss_days;
begin
  off := ((d - date '2026-01-01') % array_length(bosses, 1) + array_length(bosses, 1)) % array_length(bosses, 1);

  insert into public.world_boss_days (day, boss_id, modifier)
  values (
    d,
    bosses[1 + off],
    mods[1 + (((d - date '2026-01-01') % array_length(mods, 1) + array_length(mods, 1)) % array_length(mods, 1))]
  )
  on conflict (day) do nothing;

  select * into rec from public.world_boss_days where day = d;
  return rec;
end;
$$;

revoke all on function public.world_boss_day_info(date) from public;
grant execute on function public.world_boss_day_info(date) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 6) State untuk client (sisa attempt, rank, reward kemarin)
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
    'attempts_used', used,
    'attempts_left', 3 - used,
    'best_pct', best,
    'rank', my_rank,
    'total_players', total,
    'yesterday', yjson
  );
end;
$$;

revoke all on function public.world_boss_state(text, text) from public;
grant execute on function public.world_boss_state(text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 7) Mulai run (memotong 1 attempt)
-- -----------------------------------------------------------
create or replace function public.start_world_boss_run(
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
  today     date := public.lb_day();
  info      public.world_boss_days;
  used      integer;
  run_id    bigint;
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

  insert into public.world_boss_runs (day, username)
  values (today, uname)
  on conflict (day, username) do nothing;

  select attempts into used
    from public.world_boss_runs
   where day = today and username = uname
   for update;

  if coalesce(used, 0) >= 3 then
    return jsonb_build_object('ok', false, 'msg', 'NO_ATTEMPTS_LEFT',
                              'attempts_left', 0, 'day', today);
  end if;

  insert into public.world_boss_attempts (day, username)
  values (today, uname)
  returning id into run_id;

  update public.world_boss_runs
     set attempts = attempts + 1, updated_at = now()
   where day = today and username = uname;

  return jsonb_build_object(
    'ok', true,
    'run_id', run_id,
    'day', today,
    'boss_id', info.boss_id,
    'modifier', info.modifier,
    'attempts_left', 3 - (coalesce(used, 0) + 1)
  );
end;
$$;

revoke all on function public.start_world_boss_run(text, text) from public;
grant execute on function public.start_world_boss_run(text, text) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 8) Submit hasil run
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

  info := public.world_boss_day_info();

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
    'period', per
  );
end;
$$;

revoke all on function public.submit_world_boss_run(text, text, numeric, bigint) from public;
grant execute on function public.submit_world_boss_run(text, text, numeric, bigint) to anon, authenticated, service_role;

-- -----------------------------------------------------------
-- 9) Leaderboard (read-only, boleh tanpa auth)
-- -----------------------------------------------------------
create or replace function public.get_leaderboard(
  p_board text,
  p_period text default null,
  p_limit integer default 100,
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
  if p_board is null or p_board not in ('world_boss','inf_tower','deck_power','rarest_pull') then
    raise exception 'BAD_BOARD';
  end if;

  per := coalesce(nullif(p_period, ''), public.lb_period(p_board = 'world_boss'));
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

-- -----------------------------------------------------------
-- 10) Klaim reward harian (skor KEMARIN)
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

  select * into br from public.world_boss_bracket(yrank, ybest);

  insert into public.leaderboard_claims (period, board, username, bracket, gems, tokens, title)
  values (yper, 'world_boss', uname, br.bracket, br.gems, br.tokens, br.title)
  on conflict (period, board, username) do nothing
  returning * into claimrow;

  if claimrow is null then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_CLAIMED', 'period', yper);
  end if;

  save := coalesce(save, '{}'::jsonb);
  gems_old := coalesce(nullif(save->>'premiumGems', '')::integer, 0);
  tok_old  := coalesce(nullif(save->>'raidTokens', '')::integer, 0);
  gems_new := gems_old + br.gems;
  tok_new  := tok_old + br.tokens;

  new_save := jsonb_set(save, '{premiumGems}', to_jsonb(gems_new), true);
  new_save := jsonb_set(new_save, '{raidTokens}', to_jsonb(tok_new), true);

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
    'title', br.title,
    'premiumGems', gems_new,
    'raidTokens', tok_new
  );
end;
$$;

revoke all on function public.claim_world_boss_reward(text, text) from public;
grant execute on function public.claim_world_boss_reward(text, text) to anon, authenticated, service_role;

-- ===========================================================
-- SMOKE TEST (jalankan manual di Supabase SQL Editor setelah deploy)
-- Ganti USERNAME / HASH dengan akun uji yang ada di player_saves.
-- ===========================================================
-- 1) state hari ini (boss + modifier + sisa attempt + rank):
--    select public.world_boss_state('USERNAME', 'HASH');
--
-- 2) mulai run (maks 3x sehari; attempt langsung terpakai):
--    select public.start_world_boss_run('USERNAME', 'HASH');
--
-- 3) submit pakai run_id dari langkah 2 (0..100, boleh desimal):
--    select public.submit_world_boss_run('USERNAME', 'HASH', 42.5, <run_id>);
--
-- 4) board hari ini + posisi sendiri:
--    select public.get_leaderboard('world_boss', null, 10, 'USERNAME');
--
-- 5) reward (baru bisa kalau sudah ada skor periode KEMARIN):
--    select public.claim_world_boss_reward('USERNAME', 'HASH');
--
-- Reset uji coba (hapus data hari ini untuk username tsb):
--    delete from public.world_boss_attempts where day = public.lb_day() and username = lower('USERNAME');
--    delete from public.world_boss_runs     where day = public.lb_day() and username = lower('USERNAME');
--    delete from public.leaderboard_scores  where period = public.lb_period(true) and board = 'world_boss' and username = lower('USERNAME');
--    delete from public.leaderboard_claims  where period = to_char(public.lb_day() - 1, 'YYYY-MM-DD') and board = 'world_boss' and username = lower('USERNAME');
