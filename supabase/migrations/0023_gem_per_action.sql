-- ============================================================
-- 0023_gem_per_action.sql  —  GEM PER AKSI (ganti plafon kasar 0022)
--
-- TUJUAN: payout gem TIDAK LAGI dikirim client. Server yang tahu nominal
-- tiap aksi lewat tabel reward, dan yang menjamin aksi itu dibayar sekali
-- (atau berkooldown untuk replay). Jadi faucent tetap keluar tiap aksi
-- (sesuai desain: reward per aksi, jangan digate), tapi F12 tidak bisa
-- mencetak gem karena tidak ada lagi parameter nominal.
--
-- RPC BARU (semua security definer, JWT-only, username dari auth.uid()):
--   claim_story_gem(p_no, p_diff, p_kind)  -- first clear stage / bonus bab
--   claim_story_replay(p_lv, p_diff)       -- replay, cooldown 5 menit server
--   claim_daily_gem()                      -- login harian, 1x per hari UTC
--   exchange_tokens(p_source)              -- tukar token WB/INF -> gem
--                                             (potong token di server, atomik)
--
-- YANG DIHAPUS:
--   - earn_gems(integer) (0022) — tidak ada lagi keran generik.
--   - gem_grants         (0022) — plafon harian kasar, diganti per-aksi.
--
-- SATU-SATUNYA PLAFON: circuit breaker `c_daily` = 20.000 gem/hari per akun.
-- Ini BUKAN pembatas faucet (total faucet normal jauh di bawahnya), tapi
-- jaring terakhir kalau ada bot yang me-replay ratusan stage nonstop.
-- Kalau angka ini terasa mengganggu, naikkan — jangan hapus.
--
-- ANGKA REWARD di tabel di bawah DISALIN dari client (STORY_GEM_BASE,
-- STORY_GEM_STAGE_SHARE, DIFFS.rw, bobot reward stage). Kalau data story /
-- difficulty diubah di client, WAJIB update tabel ini juga, kalau tidak
-- angka di layar (preview) beda dengan yang dibayar server.
--
-- URUTAN DEPLOY: jalankan file ini DULU, baru push client baru.
-- ============================================================
begin;

-- ---------- 1) TABEL REWARD (data, bukan state pemain) ----------
create table if not exists public.gem_story_stage (
  lv      integer not null,
  diff    text    not null,
  gems    integer not null,   -- first clear
  replay  integer not null,   -- replay (35%, min 2)
  primary key (lv, diff)
);

create table if not exists public.gem_story_chapter (
  chapter integer not null,
  diff    text    not null,
  gems    integer not null,   -- bonus bab selesai
  primary key (chapter, diff)
);

insert into public.gem_story_stage (lv, diff, gems, replay) values
  (1,'normal',2,2),(1,'hard',2,2),(1,'extreme',3,2),(1,'nightmare',5,2),(1,'apocalypse',7,2),(2,'normal',2,2),
  (2,'hard',3,2),(2,'extreme',5,2),(2,'nightmare',7,2),(2,'apocalypse',10,4),(3,'normal',3,2),(3,'hard',5,2),
  (3,'extreme',7,2),(3,'nightmare',10,4),(3,'apocalypse',15,5),(4,'normal',5,2),(4,'hard',7,2),(4,'extreme',10,4),
  (4,'nightmare',14,5),(4,'apocalypse',20,7),(5,'normal',7,2),(5,'hard',10,4),(5,'extreme',14,5),(5,'nightmare',20,7),
  (5,'apocalypse',29,10),(6,'normal',12,4),(6,'hard',18,6),(6,'extreme',26,9),(6,'nightmare',36,13),(6,'apocalypse',54,19),
  (7,'normal',4,2),(7,'hard',6,2),(7,'extreme',8,3),(7,'nightmare',11,4),(7,'apocalypse',17,6),(8,'normal',5,2),
  (8,'hard',7,2),(8,'extreme',11,4),(8,'nightmare',14,5),(8,'apocalypse',22,8),(9,'normal',6,2),(9,'hard',9,3),
  (9,'extreme',13,5),(9,'nightmare',18,6),(9,'apocalypse',27,9),(10,'normal',7,2),(10,'hard',11,4),(10,'extreme',16,6),
  (10,'nightmare',22,8),(10,'apocalypse',33,12),(11,'normal',9,3),(11,'hard',14,5),(11,'extreme',20,7),(11,'nightmare',27,9),
  (11,'apocalypse',41,14),(12,'normal',14,5),(12,'hard',21,7),(12,'extreme',31,11),(12,'nightmare',42,15),(12,'apocalypse',63,22),
  (13,'normal',5,2),(13,'hard',8,3),(13,'extreme',11,4),(13,'nightmare',15,5),(13,'apocalypse',23,8),(14,'normal',6,2),
  (14,'hard',9,3),(14,'extreme',14,5),(14,'nightmare',19,7),(14,'apocalypse',28,10),(15,'normal',7,2),(15,'hard',11,4),
  (15,'extreme',16,6),(15,'nightmare',22,8),(15,'apocalypse',33,12),(16,'normal',9,3),(16,'hard',13,5),(16,'extreme',19,7),
  (16,'nightmare',26,9),(16,'apocalypse',39,14),(17,'normal',11,4),(17,'hard',16,6),(17,'extreme',23,8),(17,'nightmare',32,11),
  (17,'apocalypse',48,17),(18,'normal',15,5),(18,'hard',22,8),(18,'extreme',32,11),(18,'nightmare',44,15),(18,'apocalypse',66,23),
  (19,'normal',7,2),(19,'hard',10,4),(19,'extreme',14,5),(19,'nightmare',20,7),(19,'apocalypse',30,11),(20,'normal',8,3),
  (20,'hard',12,4),(20,'extreme',18,6),(20,'nightmare',24,8),(20,'apocalypse',36,13),(21,'normal',10,4),(21,'hard',14,5),
  (21,'extreme',21,7),(21,'nightmare',29,10),(21,'apocalypse',43,15),(22,'normal',11,4),(22,'hard',17,6),(22,'extreme',25,9),
  (22,'nightmare',34,12),(22,'apocalypse',51,18),(23,'normal',14,5),(23,'hard',20,7),(23,'extreme',30,11),(23,'nightmare',41,14),
  (23,'apocalypse',61,21),(24,'normal',18,6),(24,'hard',27,9),(24,'extreme',40,14),(24,'nightmare',55,19),(24,'apocalypse',82,29),
  (25,'normal',11,4),(25,'hard',16,6),(25,'extreme',23,8),(25,'nightmare',32,11),(25,'apocalypse',48,17),(26,'normal',12,4),
  (26,'hard',18,6),(26,'extreme',27,9),(26,'nightmare',36,13),(26,'apocalypse',55,19),(27,'normal',14,5),(27,'hard',20,7),
  (27,'extreme',30,11),(27,'nightmare',41,14),(27,'apocalypse',61,21),(28,'normal',15,5),(28,'hard',23,8),(28,'extreme',34,12),
  (28,'nightmare',46,16),(28,'apocalypse',70,25),(29,'normal',18,6),(29,'hard',26,9),(29,'extreme',39,14),(29,'nightmare',53,19),
  (29,'apocalypse',79,28),(30,'normal',21,7),(30,'hard',31,11),(30,'extreme',45,16),(30,'nightmare',62,22),(30,'apocalypse',93,33)
on conflict (lv, diff) do update
  set gems = excluded.gems, replay = excluded.replay;

insert into public.gem_story_chapter (chapter, diff, gems) values
  (1,'normal',10),(1,'hard',15),(1,'extreme',22),(1,'nightmare',30),(1,'apocalypse',45),(2,'normal',15),
  (2,'hard',23),(2,'extreme',33),(2,'nightmare',45),(2,'apocalypse',68),(3,'normal',18),(3,'hard',26),
  (3,'extreme',39),(3,'nightmare',53),(3,'apocalypse',79),(4,'normal',23),(4,'hard',34),(4,'extreme',50),
  (4,'nightmare',68),(4,'apocalypse',101),(5,'normal',30),(5,'hard',45),(5,'extreme',66),(5,'nightmare',90),
  (5,'apocalypse',135)
on conflict (chapter, diff) do update set gems = excluded.gems;

-- ---------- 2) LEDGER KLAIM (pengganti gem_grants) ----------
create table if not exists public.gem_claims (
  username   text        not null,
  action_key text        not null,
  gems       integer     not null default 0,   -- total yang pernah dibayar
  claims     integer     not null default 1,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (username, action_key)
);
create index if not exists gem_claims_user_day_idx
  on public.gem_claims (username, last_at desc);

-- Ledger harian terpisah: `gem_claims.gems` untuk replay bersifat KUMULATIF
-- (dipakai untuk idempotency/cooldown), jadi tidak bisa dipakai menghitung
-- pemakaian hari ini. Breaker harian pakai tabel ini.
create table if not exists public.gem_daily (
  username text    not null,
  day      date    not null default ((now() at time zone 'utc')::date),
  total    integer not null default 0,
  primary key (username, day)
);

-- Semua tabel di atas cuma dibaca definer RPC: kunci total dari client.
alter table public.gem_story_stage   enable row level security;
alter table public.gem_story_chapter enable row level security;
alter table public.gem_claims        enable row level security;
alter table public.gem_daily         enable row level security;
revoke all on public.gem_story_stage   from anon, authenticated;
revoke all on public.gem_story_chapter from anon, authenticated;
revoke all on public.gem_claims        from anon, authenticated;
revoke all on public.gem_daily         from anon, authenticated;

-- ---------- 3) RPC: first clear stage / bonus bab ----------
create or replace function public.claim_story_gem(
  p_no   integer,
  p_diff text,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily constant integer := 20000;
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gems   integer;
  v_key    text;
  v_ins    integer;
  v_today  integer;
  v_bal    integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_no is null or p_no < 1 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  if p_kind is null or p_kind not in ('stage','chapter') then
    return jsonb_build_object('ok', false, 'msg', 'BAD_KIND');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  if p_kind = 'stage' then
    select gems into v_gems from public.gem_story_stage where lv = p_no and diff = p_diff;
    v_key := 'story:first:' || p_no || ':' || p_diff;
  else
    select gems into v_gems from public.gem_story_chapter where chapter = p_no and diff = p_diff;
    v_key := 'story:chap:' || p_no || ':' || p_diff;
  end if;
  if v_gems is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_DIFF');
  end if;

  -- circuit breaker anti-bot (bukan pembatas faucet)
  select total into v_today
    from public.gem_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_today,0) + v_gems > c_daily then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_daily);
  end if;

  insert into public.gem_claims (username, action_key, gems)
  values (v_uname, v_key, v_gems)
  on conflict (username, action_key) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY', 'gems', v_gems);
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data,'{}'::jsonb), '{premiumGems}',
           to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer,0) + v_gems), true),
         updated_at = now()
   where user_id = v_uid
   returning coalesce(nullif(save_data->>'premiumGems','')::integer,0) into v_bal;

  insert into public.gem_daily (username, day, total)
  values (v_uname, (now() at time zone 'utc')::date, v_gems)
  on conflict (username, day) do update
     set total = public.gem_daily.total + excluded.total;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal);
end;
$$;

-- ---------- 4) RPC: replay story (cooldown 5 menit per stage, di server) ----------
create or replace function public.claim_story_replay(
  p_lv   integer,
  p_diff text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily constant integer := 20000;
  c_cd    constant interval := interval '5 minutes';
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gems   integer;
  v_key    text;
  v_ok     integer;
  v_today  integer;
  v_bal    integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lv is null or p_lv < 1 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select replay into v_gems from public.gem_story_stage where lv = p_lv and diff = p_diff;
  if v_gems is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_DIFF');
  end if;

  select total into v_today
    from public.gem_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_today,0) + v_gems > c_daily then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_daily);
  end if;

  v_key := 'replay:' || p_lv || ':' || p_diff;
  insert into public.gem_claims (username, action_key, gems, claims, last_at)
  values (v_uname, v_key, v_gems, 1, now())
  on conflict (username, action_key) do update
     set gems    = public.gem_claims.gems + excluded.gems,
         claims  = public.gem_claims.claims + 1,
         last_at = now()
   where public.gem_claims.last_at <= now() - c_cd
  returning 1 into v_ok;

  if v_ok is null then
    return jsonb_build_object('ok', false, 'msg', 'COOLDOWN', 'gems', v_gems);
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data,'{}'::jsonb), '{premiumGems}',
           to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer,0) + v_gems), true),
         updated_at = now()
   where user_id = v_uid
   returning coalesce(nullif(save_data->>'premiumGems','')::integer,0) into v_bal;

  insert into public.gem_daily (username, day, total)
  values (v_uname, (now() at time zone 'utc')::date, v_gems)
  on conflict (username, day) do update
     set total = public.gem_daily.total + excluded.total;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal);
end;
$$;

-- ---------- 5) RPC: login harian (1x per hari UTC, siklus 7 hari di server) ----------
create or replace function public.claim_daily_gem()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cycle constant integer[] := array[10,15,20,25,30,40,60];
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_n      integer;
  v_gems   integer;
  v_key    text;
  v_ins    integer;
  v_bal    integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select count(*) into v_n
    from public.gem_claims
   where username = v_uname and action_key like 'daily:%';
  v_gems := c_cycle[(v_n % 7) + 1];

  v_key := 'daily:' || ((now() at time zone 'utc')::date)::text;
  insert into public.gem_claims (username, action_key, gems)
  values (v_uname, v_key, v_gems)
  on conflict (username, action_key) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_TODAY');
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data,'{}'::jsonb), '{premiumGems}',
           to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer,0) + v_gems), true),
         updated_at = now()
   where user_id = v_uid
   returning coalesce(nullif(save_data->>'premiumGems','')::integer,0) into v_bal;

  insert into public.gem_daily (username, day, total)
  values (v_uname, (now() at time zone 'utc')::date, v_gems)
  on conflict (username, day) do update
     set total = public.gem_daily.total + excluded.total;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal,
                            'day_index', (v_n % 7) + 1);
end;
$$;

-- ---------- 6) RPC: tukar token -> gem (potong token di server, atomik) ----------
create or replace function public.exchange_tokens(p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_cost  integer;
  v_gems  integer;
  v_key   text;
  v_bal   integer;
  v_tok   integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_source = 'wb' then
    v_cost := 100; v_gems := 20; v_key := 'wbTokens';
  elsif p_source = 'inf' then
    v_cost := 10;  v_gems := 10; v_key := 'infTokens';
  else
    return jsonb_build_object('ok', false, 'msg', 'BAD_SOURCE');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  update public.player_saves
     set save_data = jsonb_set(
           jsonb_set(coalesce(save_data,'{}'::jsonb), '{premiumGems}',
             to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer,0) + v_gems), true),
           array[v_key]::text[],
           to_jsonb(coalesce(nullif(save_data->>v_key,'')::integer,0) - v_cost), true),
         updated_at = now()
   where user_id = v_uid
     and coalesce(nullif(save_data->>v_key,'')::integer,0) >= v_cost
   returning coalesce(nullif(save_data->>'premiumGems','')::integer,0),
             coalesce(nullif(save_data->>v_key,'')::integer,0)
     into v_bal, v_tok;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'TOKEN_KURANG');
  end if;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal, 'tokens', v_tok);
end;
$$;

-- ---------- 7) Tutup keran lama ----------
drop function if exists public.earn_gems(integer);
drop table if exists public.gem_grants;

-- ---------- 8) Grant: JWT-only, anon eksplisit dicabut ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.claim_story_gem(integer, text, text)',
    'public.claim_story_replay(integer, text)',
    'public.claim_daily_gem()',
    'public.exchange_tokens(text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

commit;

-- ============================================================
-- VERIFIKASI
--   -- 1) earn_gems & gem_grants harus hilang:
--   select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname='earn_gems';            -- 0
--   select count(*) from information_schema.tables
--    where table_schema='public' and table_name='gem_grants';       -- 0
--
--   -- 2) tabel reward + ledger harus penuh tapi terkunci:
--   select count(*) from public.gem_story_stage;    -- 150
--   select count(*) from public.gem_story_chapter;  -- 25
--   -- anon select harus 401:
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "$SUPABASE_URL/rest/v1/gem_story_stage?select=*" -H "apikey: $ANON"
--
--   -- 3) anon panggil RPC baru harus 401 (bukan 200 AUTH_REQUIRED):
--   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
--     "$SUPABASE_URL/rest/v1/rpc/claim_daily_gem" -H "apikey: $ANON" \
--     -H "Content-Type: application/json" -d '{}'
--
--   -- 4) cek klaim & pemakaian harian:
--   select username, action_key, gems, claims, last_at
--     from public.gem_claims order by last_at desc limit 30;
-- ============================================================
