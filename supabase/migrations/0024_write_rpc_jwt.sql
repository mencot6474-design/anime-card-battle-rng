-- ============================================================
-- 0024_write_rpc_jwt.sql — FASE 3: tulis RPC pakai auth.uid()
--
-- SEBELUM: setiap RPC tulis menerima `p_username` + `p_password_hash`, lalu
-- membandingkan hash itu dengan kolom `password`. Artinya hash = bearer token:
-- siapa pun yang punya hash satu akun bisa menulis save akun itu. Selain itu
-- identitas pemain dikirim dari klien, jadi bisa dikarang.
--
-- SESUDAH: identitas SATU-SATUNYA sumbernya `auth.uid()` → baris
-- player_saves.user_id. Tidak ada parameter username/hash lagi, jadi:
--   - F12 tidak bisa menyebut nama akun lain,
--   - hash tidak lagi berfungsi sebagai kunci tulis,
--   - anon (tanpa JWT) ditolak 401 sebelum logika apa pun jalan.
--
-- YANG DIMIGRASI (9 RPC):
--   register_player, merge_player_state, spend_gems, buy_global_luck,
--   submit_leaderboard_score, world_boss_state, start_world_boss_run,
--   submit_world_boss_run, claim_world_boss_reward
--
-- TETAP PUBLIK/ANON (read-only, tidak menyentuh akun siapa pun):
--   check_credentials (pra-login), get_leaderboard, get_player_profile,
--   get_player_avatars.
--
-- Signature lama DI-DROP, bukan dibiarkan: `create or replace` dengan argumen
-- beda hanya menambah overload, dan overload lama masih dieksekusi role anon.
--
-- CATATAN: `register_player` tidak lagi menulis kolom `password` (hash djb2).
-- Akun baru diautentikasi lewat Supabase Auth. Kolom itu dibiarkan ada untuk
-- akun lama (check_credentials di jalur login legacy).
--
-- URUTAN DEPLOY: jalankan file ini DULU, baru push client baru.
-- ============================================================
begin;

-- ---------- 0) Buang signature lama (termasuk overload WB dari 0005) ----------
drop function if exists public.register_player(text, text, jsonb);
drop function if exists public.merge_player_state(text, text, jsonb, boolean, boolean);
drop function if exists public.spend_gems(text, text, integer, boolean, jsonb);
drop function if exists public.buy_global_luck(text, text);
drop function if exists public.submit_leaderboard_score(text, text, text, numeric, jsonb);
drop function if exists public.world_boss_state(text, text);
drop function if exists public.world_boss_state(text, text, text);
drop function if exists public.start_world_boss_run(text, text);
drop function if exists public.start_world_boss_run(text, text, text);
drop function if exists public.submit_world_boss_run(text, text, numeric, bigint);
drop function if exists public.submit_world_boss_run(text, text, bigint, bigint, text);
drop function if exists public.claim_world_boss_reward(text, text);
drop function if exists public.claim_world_boss_reward(text, text, text);

-- ---------- 1) REGISTER: uid pemilik save ditentukan server ----------
-- Akun baru tidak lagi punya hash djb2, jadi kolom password harus boleh NULL
-- (sebelumnya NOT NULL — tanpa ini insert register_player gagal 23502).
alter table public.player_saves alter column password drop not null;

create or replace function public.register_player(
  p_username  text,
  p_save_data jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  u       text;
  v_taken boolean;
  v_mine  text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_username is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  -- Satu akun Auth = satu save (unique index 0018). Kalau uid ini sudah
  -- punya save, jawab nama yang dia pegang — jangan bikin baris kedua.
  select username into v_mine from public.player_saves where user_id = v_uid limit 1;
  if v_mine is not null then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', v_mine);
  end if;

  select exists (select 1 from public.player_saves where username = u) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', u);
  end if;

  insert into public.player_saves (username, save_data, user_id)
  values (u, p_save_data, v_uid);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

-- ---------- 2) SIMPAN STATE: merge atomik milik uid sendiri ----------
create or replace function public.merge_player_state(
  p_save_data jsonb,
  p_allow_gem_decrease boolean default false,
  p_skip_stacks boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  cur_gems  integer;
  new_gems  integer;
  merged    jsonb;
  old_save  jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_save_data is null then
    raise exception 'BAD_INPUT';
  end if;

  select username, coalesce(nullif(save_data->>'premiumGems','')::integer, 0), save_data
    into uname, cur_gems, old_save
    from public.player_saves where user_id = v_uid limit 1;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  new_gems := coalesce(nullif(p_save_data->>'premiumGems','')::integer, 0);

  -- Saldo cloud = authoritative.
  if p_allow_gem_decrease and new_gems < cur_gems then
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(new_gems), true);
  else
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(cur_gems), true);
  end if;

  -- Inventori ditahan kalau client minta (push ringan saat auto-roll).
  if p_skip_stacks then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  end if;

  update public.player_saves
     set save_data = merged, updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'premiumGems',
    coalesce(nullif(merged->>'premiumGems','')::integer, cur_gems));
end;
$$;

-- ---------- 3) POTONG GEM (belanja) ----------
create or replace function public.spend_gems(
  p_cost integer,
  p_allow_gem_decrease boolean default false,
  p_save_data jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  cur_gems  integer;
  merged    jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'BAD_INPUT';
  end if;

  select username, coalesce(nullif(save_data->>'premiumGems','')::integer, 0)
    into uname, cur_gems
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  if cur_gems < p_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', cur_gems, 'cost', p_cost);
  end if;

  merged := coalesce(p_save_data, (select save_data from public.player_saves
                                    where user_id = v_uid));
  merged := jsonb_set(coalesce(merged, '{}'::jsonb), '{premiumGems}',
                      to_jsonb(cur_gems - p_cost), true);

  update public.player_saves
     set save_data = merged, updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'balance', cur_gems - p_cost, 'cost', p_cost);
end;
$$;

-- ---------- 4) GLOBAL LUCK (bayar gem + stack buff, atomik) ----------
create or replace function public.buy_global_luck()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- konstanta server (kebenaran tunggal; client cuma display)
  c_cost   integer := 1200;          -- harga gem per aktivasi
  c_step   integer := 10;            -- +multiplier per stack
  c_max    integer := 100;           -- plafon multiplier
  c_step_ms interval := interval '1 hour';   -- +durasi per stack
  c_max_win interval := interval '10 hours'; -- ends_at tak boleh lewat now+10 jam

  v_uid     uuid := auth.uid();
  uname     text;
  cur_gems  integer;
  merged    jsonb;

  g_id      bigint;
  g_mult    integer;
  g_end     timestamptz;
  g_act     timestamptz;
  new_mult  integer;
  new_end   timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  -- serialisasi antar-pembelian
  perform pg_advisory_xact_lock(hashtext('global_luck'));

  -- baca + kunci baris player (saldo gem)
  select username, coalesce(nullif(save_data->>'premiumGems','')::integer, 0)
    into uname, cur_gems
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  -- baca + kunci baris buff aktif (ends_at > now)
  select id, multiplier, ends_at, activated_at
    into g_id, g_mult, g_end, g_act
    from public.global_luck
   where ends_at > now()
   order by ends_at desc
   limit 1
   for update;

  -- kalau sudah mentok max, jangan potong gem
  if g_id is not null and coalesce(g_mult, 0) >= c_max then
    return jsonb_build_object('ok', false, 'msg', 'SUDAH_MAX',
                              'multiplier', g_mult, 'ends_at', g_end);
  end if;

  -- saldo cukup?
  if cur_gems < c_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', cur_gems, 'cost', c_cost);
  end if;

  -- hitung buff baru (server-side)
  new_mult := least(coalesce(g_mult, 0) + c_step, c_max);
  if g_id is not null then
    new_end := least(g_end + c_step_ms, now() + c_max_win);
  else
    new_end := now() + c_step_ms;
  end if;

  -- potong gem di save_data (sama seperti spend_gems)
  merged := jsonb_set(coalesce((select save_data from public.player_saves
                                where user_id = v_uid), '{}'::jsonb),
                      '{premiumGems}', to_jsonb(cur_gems - c_cost), true);
  update public.player_saves
     set save_data = merged, updated_at = now()
   where user_id = v_uid;

  -- upsert buff
  if g_id is not null then
    update public.global_luck
       set multiplier = new_mult,
           ends_at    = new_end,
           activated_by = uname
     where id = g_id;
  else
    insert into public.global_luck (activated_by, activated_at, ends_at, multiplier)
    values (uname, now(), new_end, new_mult);
  end if;

  return jsonb_build_object(
    'ok', true,
    'balance', cur_gems - c_cost,
    'cost', c_cost,
    'multiplier', new_mult,
    'ends_at', new_end,
    'activated_by', uname
  );
end;
$$;

-- ---------- 5) SKOR PAPAN (plafon + anti-jump + kuota harian tetap) ----------
create or replace function public.submit_leaderboard_score(
  p_board text,
  p_value numeric,
  p_meta  jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  brd       text := p_board;
  per       text := public.lb_period(false);   -- papan non-WB = mingguan (ISO week)
  req       numeric;
  meta      jsonb := coalesce(p_meta, '{}'::jsonb);

  -- ---- PLAFON / ATURAN LAJU per papan (EDIT ANGKA DI SINI) ----
  c_abs       numeric;   -- plafon absolut nilai
  c_step_mul  numeric;   -- lama: old × ini
  c_step_add  numeric;   -- lama: + ini per submit
  c_first     numeric;   -- skor pertama (baris baru) maks segini
  c_daily_max integer := 500;   -- maks KENAIKAN / user / papan / hari

  old_val  numeric;
  old_day  text;
  old_cnt  integer;
  eff      numeric;
  day_key  text := ((now() at time zone 'utc')::date)::text;
  new_cnt  integer;
  row_value numeric;
  row_at    timestamptz;
  my_rank   integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if brd is null or brd not in ('inf_tower', 'deck_power', 'rarest_pull') then
    raise exception 'BAD_BOARD';
  end if;
  if jsonb_typeof(meta) <> 'object' or pg_column_size(meta) > 2048 then
    meta := '{}'::jsonb;
  end if;
  req := greatest(0, least(coalesce(p_value, 0), 1e21::numeric));

  select username into uname from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  -- pilih aturan per papan
  if brd = 'inf_tower' then
    c_abs := 1000000;  c_step_mul := 1;    c_step_add := 200; c_first := 1000;
  elsif brd = 'deck_power' then
    c_abs := 1000000000; c_step_mul := 10; c_step_add := 0;   c_first := 1000000000;
  else -- rarest_pull
    c_abs := 1e20;     c_step_mul := 1000; c_step_add := 0;   c_first := 1e20;
  end if;

  select value, inc_day, inc_count into old_val, old_day, old_cnt
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  -- tidak ada kenaikan (atau nilai ≤ skor yang tersimpan) → simpan apa adanya,
  -- skor tidak pernah turun. Kembalikan skor kini.
  if old_val is not null and old_val >= req then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank);
  end if;

  -- nilai efektif = permintaan dipotong plafon absolut lalu anti-jump
  eff := least(req, c_abs);
  if old_val is null then
    eff := least(eff, c_first);
  else
    eff := least(eff, old_val * c_step_mul + c_step_add);
  end if;

  -- hitung ulang kuota hari ini (reset kalau beda hari UTC)
  if old_day is distinct from day_key then
    old_cnt := 0;
  end if;

  -- kalau masih mau naik tapi kuota harian habis → TOLAK naik (skor lama)
  if eff > coalesce(old_val, 0)
     and old_val is not null
     and coalesce(old_cnt, 0) >= c_daily_max then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank, 'capped', 'daily');
  end if;

  new_cnt := coalesce(old_cnt, 0)
             + case when eff > coalesce(old_val, 0) then 1 else 0 end;

  insert into public.leaderboard_scores
    (period, board, username, value, meta, updated_at, inc_day, inc_count)
  values (per, brd, uname, eff, meta, now(), day_key, new_cnt)
  on conflict (period, board, username) do update
    set value = excluded.value,
        meta = excluded.meta,
        updated_at = now(),
        inc_day = excluded.inc_day,
        inc_count = excluded.inc_count
    where public.leaderboard_scores.value < excluded.value;

  select value, updated_at into row_value, row_at
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  my_rank := public.lb_rank(per, brd, row_value, row_at);

  return jsonb_build_object(
    'ok', true,
    'board', brd,
    'period', per,
    'value', row_value,
    'rank', my_rank
  );
end;
$$;

-- ---------- 6) WORLD BOSS: state pemain sendiri ----------
create or replace function public.world_boss_state(
  p_boss text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
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

-- ---------- 7) WORLD BOSS: mulai run ----------
create or replace function public.start_world_boss_run(
  p_boss text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  today     date := public.lb_day();
  info      public.world_boss_days;
  used      integer;
  run_id    bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  select username into uname from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
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

-- ---------- 8) WORLD BOSS: submit damage ----------
create or replace function public.submit_world_boss_run(
  p_dmg    bigint,
  p_run_id bigint,
  p_boss   text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
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
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_run_id is null or p_dmg is null then
    raise exception 'BAD_INPUT';
  end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

  dmg_in := greatest(0, least(coalesce(p_dmg, 0), public.world_boss_pool_size()));

  select username into uname from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
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

-- ---------- 9) WORLD BOSS: klaim reward kemarin ----------
create or replace function public.claim_world_boss_reward(
  p_boss text default 'RAID_ETERNAL_DRAGON'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  boss      text := coalesce(nullif(p_boss, ''), 'RAID_ETERNAL_DRAGON');
  brd       text;
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
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if boss not in ('RAID_ETERNAL_DRAGON', 'RAID_SHADOW_KING') then
    raise exception 'BAD_BOSS';
  end if;

  brd := case boss when 'RAID_SHADOW_KING' then 'world_boss_b' else 'world_boss' end;

  select username, save_data into uname, save
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
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
   where user_id = v_uid;

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

-- ---------- 10) Grant: JWT-only, anon dicabut eksplisit ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.register_player(text, jsonb)',
    'public.merge_player_state(jsonb, boolean, boolean)',
    'public.spend_gems(integer, boolean, jsonb)',
    'public.buy_global_luck()',
    'public.submit_leaderboard_score(text, numeric, jsonb)',
    'public.world_boss_state(text)',
    'public.start_world_boss_run(text)',
    'public.submit_world_boss_run(bigint, bigint, text)',
    'public.claim_world_boss_reward(text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;

-- ============================================================
-- VERIFIKASI (anon harus 401, bukan 200 AUTH_REQUIRED):
--   for f in register_player merge_player_state spend_gems buy_global_luck \
--            submit_leaderboard_score world_boss_state start_world_boss_run \
--            submit_world_boss_run claim_world_boss_reward; do
--     curl -s -o /dev/null -w "$f %{http_code}\n" -X POST \
--       "$URL/rest/v1/rpc/$f" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}'
--   done
--   -- signature lama harus 404 (sudah di-drop):
--   curl ... -d '{"p_username":"x","p_password_hash":"y","p_save_data":{}}' rpc/merge_player_state
-- ============================================================
