-- 0025_coin_economy.sql — Unit 3a: COIN server-authoritative
--
-- Celah sebelum ini: `coins` ada di save_data dan merge_player_state menerima
-- seluruh save dari client, jadi F12 cukup menulis state.coins = 1e12 lalu save().
--
-- Model yang dipakai (sama seperti premiumGems 0023):
--   * PENAMBAHAN coin HANYA lewat RPC klaim di bawah, dihitung server dari tabel
--     harga yang dicerminkan dari client; setiap RPC mengembalikan `coins_balance`.
--   * PENGURANGAN (belanja) dikirim client sebagai `_coinSpend` transient di
--     p_save_data, lalu merge mengurangkan angka itu dari saldo server. Nilai
--     absolut `coins` dari client TIDAK pernah dipercaya: kalau client kirim
--     angka lebih tinggi, saldo server dipertahankan; kalau lebih rendah tanpa
--     _coinSpend (save basi dari device lain), saldo server juga dipertahankan.
--     Menurunkan saldo sendiri tidak menguntungkan cheater, jadi ini aman.
--
-- Batas jujur: battle jalan di client, jadi server tidak bisa MEMBUKTIKAN stage
-- benar-benar dimenangkan. Yang ditegakkan server: first clear sekali seumur akun,
-- replay ber-cooldown 5 menit per stage (sama dengan cooldown UI), dan breaker
-- harian. Ini menaikkan ambang cheat, bukan membuatnya mustahil.
--
-- Yang BELUM disentuh (unit berikutnya): wbTokens/infTokens & playerLv/xp, karena
-- sink token memberi item yang kepemilikannya masih di save_data — mengunci saldo
-- token tanpa mengunci inventori cuma kosmetik. `buy_wb_coins` di bawah memotong
-- token dari save_data secara atomik (seperti exchange_tokens 0023) dan dibatasi
-- 100 pembelian/hari supaya token hasil edit save tidak bisa jadi coin tanpa batas.

-- ---------- 1) TABEL HARGA (cermin client) ----------
-- first coins = round(reward_lv * DIFFS.rw), replay = round(first * 0.2)
-- Sumber: js/data.js STORY_BIBLE + js/cards-fx.js DIFFS. Kalau dua file itu
-- berubah, regenerate tabel ini — kalau tidak, coin di layar beda dengan yang dibayar.
create table if not exists public.coin_story_stage (
  lv     integer not null,
  diff   text    not null,
  coins  bigint  not null,   -- first clear
  replay bigint  not null,   -- 20% dari first
  primary key (lv, diff)
);

insert into public.coin_story_stage (lv, diff, coins, replay) values
(1,'normal',300,60),
(1,'hard',450,90),
(1,'extreme',660,132),
(1,'nightmare',900,180),
(1,'apocalypse',1350,270),
(2,'normal',450,90),
(2,'hard',675,135),
(2,'extreme',990,198),
(2,'nightmare',1350,270),
(2,'apocalypse',2025,405),
(3,'normal',650,130),
(3,'hard',975,195),
(3,'extreme',1430,286),
(3,'nightmare',1950,390),
(3,'apocalypse',2925,585),
(4,'normal',900,180),
(4,'hard',1350,270),
(4,'extreme',1980,396),
(4,'nightmare',2700,540),
(4,'apocalypse',4050,810),
(5,'normal',1300,260),
(5,'hard',1950,390),
(5,'extreme',2860,572),
(5,'nightmare',3900,780),
(5,'apocalypse',5850,1170),
(6,'normal',2400,480),
(6,'hard',3600,720),
(6,'extreme',5280,1056),
(6,'nightmare',7200,1440),
(6,'apocalypse',10800,2160),
(7,'normal',3000,600),
(7,'hard',4500,900),
(7,'extreme',6600,1320),
(7,'nightmare',9000,1800),
(7,'apocalypse',13500,2700),
(8,'normal',3800,760),
(8,'hard',5700,1140),
(8,'extreme',8360,1672),
(8,'nightmare',11400,2280),
(8,'apocalypse',17100,3420),
(9,'normal',4700,940),
(9,'hard',7050,1410),
(9,'extreme',10340,2068),
(9,'nightmare',14100,2820),
(9,'apocalypse',21150,4230),
(10,'normal',5800,1160),
(10,'hard',8700,1740),
(10,'extreme',12760,2552),
(10,'nightmare',17400,3480),
(10,'apocalypse',26100,5220),
(11,'normal',7200,1440),
(11,'hard',10800,2160),
(11,'extreme',15840,3168),
(11,'nightmare',21600,4320),
(11,'apocalypse',32400,6480),
(12,'normal',11000,2200),
(12,'hard',16500,3300),
(12,'extreme',24200,4840),
(12,'nightmare',33000,6600),
(12,'apocalypse',49500,9900),
(13,'normal',14000,2800),
(13,'hard',21000,4200),
(13,'extreme',30800,6160),
(13,'nightmare',42000,8400),
(13,'apocalypse',63000,12600),
(14,'normal',17000,3400),
(14,'hard',25500,5100),
(14,'extreme',37400,7480),
(14,'nightmare',51000,10200),
(14,'apocalypse',76500,15300),
(15,'normal',20000,4000),
(15,'hard',30000,6000),
(15,'extreme',44000,8800),
(15,'nightmare',60000,12000),
(15,'apocalypse',90000,18000),
(16,'normal',24000,4800),
(16,'hard',36000,7200),
(16,'extreme',52800,10560),
(16,'nightmare',72000,14400),
(16,'apocalypse',108000,21600),
(17,'normal',29000,5800),
(17,'hard',43500,8700),
(17,'extreme',63800,12760),
(17,'nightmare',87000,17400),
(17,'apocalypse',130500,26100),
(18,'normal',40000,8000),
(18,'hard',60000,12000),
(18,'extreme',88000,17600),
(18,'nightmare',120000,24000),
(18,'apocalypse',180000,36000),
(19,'normal',52000,10400),
(19,'hard',78000,15600),
(19,'extreme',114400,22880),
(19,'nightmare',156000,31200),
(19,'apocalypse',234000,46800),
(20,'normal',63000,12600),
(20,'hard',94500,18900),
(20,'extreme',138600,27720),
(20,'nightmare',189000,37800),
(20,'apocalypse',283500,56700),
(21,'normal',76000,15200),
(21,'hard',114000,22800),
(21,'extreme',167200,33440),
(21,'nightmare',228000,45600),
(21,'apocalypse',342000,68400),
(22,'normal',90000,18000),
(22,'hard',135000,27000),
(22,'extreme',198000,39600),
(22,'nightmare',270000,54000),
(22,'apocalypse',405000,81000),
(23,'normal',108000,21600),
(23,'hard',162000,32400),
(23,'extreme',237600,47520),
(23,'nightmare',324000,64800),
(23,'apocalypse',486000,97200),
(24,'normal',145000,29000),
(24,'hard',217500,43500),
(24,'extreme',319000,63800),
(24,'nightmare',435000,87000),
(24,'apocalypse',652500,130500),
(25,'normal',165000,33000),
(25,'hard',247500,49500),
(25,'extreme',363000,72600),
(25,'nightmare',495000,99000),
(25,'apocalypse',742500,148500),
(26,'normal',188000,37600),
(26,'hard',282000,56400),
(26,'extreme',413600,82720),
(26,'nightmare',564000,112800),
(26,'apocalypse',846000,169200),
(27,'normal',212000,42400),
(27,'hard',318000,63600),
(27,'extreme',466400,93280),
(27,'nightmare',636000,127200),
(27,'apocalypse',954000,190800),
(28,'normal',240000,48000),
(28,'hard',360000,72000),
(28,'extreme',528000,105600),
(28,'nightmare',720000,144000),
(28,'apocalypse',1080000,216000),
(29,'normal',272000,54400),
(29,'hard',408000,81600),
(29,'extreme',598400,119680),
(29,'nightmare',816000,163200),
(29,'apocalypse',1224000,244800),
(30,'normal',320000,64000),
(30,'hard',480000,96000),
(30,'extreme',704000,140800),
(30,'nightmare',960000,192000),
(30,'apocalypse',1440000,288000)
on conflict (lv, diff) do update
  set coins = excluded.coins, replay = excluded.replay;

-- ---------- 2) LEDGER ----------
create table if not exists public.coin_claims (
  username   text        not null,
  action_key text        not null,
  coins      bigint      not null default 0,  -- total yang pernah dibayar untuk key ini
  claims     integer     not null default 1,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (username, action_key)
);

create table if not exists public.coin_daily (
  username text    not null,
  day      date    not null default ((now() at time zone 'utc')::date),
  claims   integer not null default 0,
  total    bigint  not null default 0,
  primary key (username, day)
);

alter table public.coin_story_stage enable row level security;
alter table public.coin_claims      enable row level security;
alter table public.coin_daily       enable row level security;
revoke all on public.coin_story_stage from anon, authenticated;
revoke all on public.coin_claims      from anon, authenticated;
revoke all on public.coin_daily       from anon, authenticated;

-- ---------- 3) HELPER INTERNAL ----------
-- `coins` yang bukan bilangan bulat wajar (mis. "1e+21" hasil edit save) tidak
-- boleh melempar 22P02 dan mematikan seluruh merge: jatuh ke 1000.
create or replace function public._coins_of(p jsonb)
returns bigint
language sql
immutable
as $$
  select case
           when coalesce(p->>'coins','') ~ '^[0-9]{1,15}$' then (p->>'coins')::bigint
           else 1000::bigint
         end;
$$;

create or replace function public._coin_credit(p_uid uuid, p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal bigint;
begin
  update public.player_saves
     set save_data = jsonb_set(
           coalesce(save_data,'{}'::jsonb), '{coins}',
           to_jsonb(public._coins_of(coalesce(save_data,'{}'::jsonb)) + greatest(0, p_amount)), true),
         updated_at = now()
   where user_id = p_uid
   returning public._coins_of(save_data) into v_bal;
  return coalesce(v_bal, 0);
end;
$$;

create or replace function public._coin_daily_add(p_uname text, p_amount bigint, p_claims integer default 1)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.coin_daily (username, day, claims, total)
  values (p_uname, (now() at time zone 'utc')::date, greatest(0, p_claims), greatest(0, p_amount))
  on conflict (username, day) do update
     set claims = public.coin_daily.claims + excluded.claims,
         total  = public.coin_daily.total  + excluded.total;
$$;

-- ---------- 4) RPC: coin kemenangan story ----------
create or replace function public.claim_story_coins(p_lv integer, p_diff text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily constant bigint := 5000000;   -- breaker anti-bot, bukan gate faucet
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_first  bigint;
  v_rep    bigint;
  v_amt    bigint;
  v_kind   text := 'first';
  v_last   timestamptz;
  v_today  bigint;
  v_ins    integer;
  v_bal    bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lv is null or p_lv < 1 or p_lv > 1000 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select coins, replay into v_first, v_rep
    from public.coin_story_stage where lv = p_lv and diff = p_diff;
  if v_first is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_DIFF');
  end if;

  select last_at into v_last
    from public.coin_claims
   where username = v_uname and action_key = 'coin:storyfirst:' || p_lv || ':' || p_diff;

  if v_last is not null then
    -- Replay punya key cooldown SENDIRI: replay pertama tepat setelah first clear
    -- masih boleh (client baru memasang storyCd setelah replay selesai).
    select last_at into v_last
      from public.coin_claims
     where username = v_uname and action_key = 'coin:storyr:' || p_lv || ':' || p_diff;
    if v_last is not null and v_last > now() - interval '5 minutes' then
      return jsonb_build_object('ok', false, 'msg', 'COOLDOWN');
    end if;
    v_kind := 'replay';
    v_amt  := v_rep;
  else
    v_amt := v_first;
  end if;

  select total into v_today
    from public.coin_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_today,0) + v_amt > c_daily then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_daily);
  end if;

  if v_kind = 'replay' then
    insert into public.coin_claims (username, action_key, coins, claims)
    values (v_uname, 'coin:storyr:' || p_lv || ':' || p_diff, v_amt, 1)
    on conflict (username, action_key) do update
       set coins = public.coin_claims.coins + excluded.coins,
           claims = public.coin_claims.claims + 1,
           last_at = now();
  else
    insert into public.coin_claims (username, action_key, coins)
    values (v_uname, 'coin:storyfirst:' || p_lv || ':' || p_diff, v_amt)
    on conflict (username, action_key) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then
      return jsonb_build_object('ok', false, 'msg', 'ALREADY');
    end if;
  end if;

  v_bal := public._coin_credit(v_uid, v_amt);
  perform public._coin_daily_add(v_uname, v_amt, 1);

  return jsonb_build_object('ok', true, 'coins', v_amt, 'kind', v_kind,
                            'coins_balance', v_bal);
end;
$$;

-- ---------- 5) RPC: coin per lantai Inf Tower ----------
-- Reward = 500+f*60 (lantai bos, tiap 5) atau 150+f*30, cermin towerReward().
-- Tanpa cek urutan lantai: pemain boleh masuk run ulang dari lantai 1, dan run
-- yang sudah jalan saat migration dipasang tidak boleh mendadak kehilangan coin.
-- Pembatasnya claim/hari + breaker coin harian.
create or replace function public.claim_tower_coins(p_floor integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_daily  constant bigint  := 5000000;
  c_claims constant integer := 800;
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_amt    bigint;
  v_today  bigint;
  v_claim  integer;
  v_bal    bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  v_amt := case when p_floor % 5 = 0 then 500 + p_floor::bigint * 60
                else 150 + p_floor::bigint * 30 end;

  select total, claims into v_today, v_claim
    from public.coin_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_claim,0) + 1 > c_claims then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_claims);
  end if;
  if coalesce(v_today,0) + v_amt > c_daily then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_daily);
  end if;

  v_bal := public._coin_credit(v_uid, v_amt);
  perform public._coin_daily_add(v_uname, v_amt, 1);

  return jsonb_build_object('ok', true, 'coins', v_amt, 'coins_balance', v_bal);
end;
$$;

-- ---------- 6) RPC: 12 token World Boss -> 2.000 coin ----------
-- Token masih dibaca dari save_data (0023 pola yang sama), tapi pemotongan token
-- + penambahan coin satu UPDATE, dan jumlah pembelian dibatasi per hari.
create or replace function public.buy_wb_coins()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cost  constant integer := 12;
  c_gain  constant bigint  := 2000;
  c_buys  constant integer := 100;      -- 200k coin/hari dari jalur token
  v_uid   uuid := auth.uid();
  v_uname text;
  v_tok   integer;
  v_bal   bigint;
  v_ins   integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  insert into public.coin_claims (username, action_key, coins, claims)
  values (v_uname, 'coin:wbcoins:' || ((now() at time zone 'utc')::date)::text, 0, 0)
  on conflict (username, action_key) do nothing;

  update public.coin_claims
     set claims = claims + 1, coins = coins + c_gain, last_at = now()
   where username = v_uname
     and action_key = 'coin:wbcoins:' || ((now() at time zone 'utc')::date)::text
     and claims < c_buys;
  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_buys);
  end if;

  update public.player_saves
     set save_data = jsonb_set(
           jsonb_set(save_data, '{wbTokens}',
             to_jsonb(coalesce(nullif(save_data->>'wbTokens','')::integer,0) - c_cost), true),
           '{coins}', to_jsonb(public._coins_of(save_data) + c_gain), true),
         updated_at = now()
   where user_id = v_uid
     and coalesce(nullif(save_data->>'wbTokens','')::integer,0) >= c_cost
   returning public._coins_of(save_data),
             coalesce(nullif(save_data->>'wbTokens','')::integer,0)
     into v_bal, v_tok;

  if v_bal is null then
    -- token kurang: batalkan jatah pembelian yang tadi dipakai
    update public.coin_claims
       set claims = claims - 1, coins = coins - c_gain
     where username = v_uname
       and action_key = 'coin:wbcoins:' || ((now() at time zone 'utc')::date)::text;
    return jsonb_build_object('ok', false, 'msg', 'TOKEN_KURANG');
  end if;

  perform public._coin_daily_add(v_uname, c_gain, 1);

  return jsonb_build_object('ok', true, 'coins', c_gain,
                            'coins_balance', v_bal, 'tokens', v_tok);
end;
$$;

-- ---------- 7) DAILY LOGIN: sekalian bayar coin ----------
-- Signature tidak berubah (dipanggil client yang sama), hanya badan yang ditambah
-- supaya coin ikut server. Siklus 7 hari dihitung dari ledger server (v_n), bukan
-- dari state.dailyIndex client.
create or replace function public.claim_daily_gem()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cycle_gem  constant integer[] := array[10,15,20,25,30,40,60];
  c_cycle_coin constant bigint[]  := array[30000,50000,70000,100000,150000,200000,400000];
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_n      integer;
  v_gems   integer;
  v_coins  bigint;
  v_key    text;
  v_ins    integer;
  v_bal    integer;
  v_cbal   bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select count(*) into v_n
    from public.gem_claims
   where username = v_uname and action_key like 'daily:%';
  v_gems  := c_cycle_gem[(v_n % 7) + 1];
  v_coins := c_cycle_coin[(v_n % 7) + 1];

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

  v_cbal := public._coin_credit(v_uid, v_coins);
  perform public._coin_daily_add(v_uname, v_coins, 1);

  insert into public.gem_daily (username, day, total)
  values (v_uname, (now() at time zone 'utc')::date, v_gems)
  on conflict (username, day) do update
     set total = public.gem_daily.total + excluded.total;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal,
                            'coins', v_coins, 'coins_balance', v_cbal,
                            'day_index', (v_n % 7) + 1);
end;
$$;

-- ---------- 8) MERGE: coin tidak lagi dari client ----------
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
  cur_coins bigint;
  spent     bigint;
  merged    jsonb;
  old_save  jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_save_data is null then
    raise exception 'BAD_INPUT';
  end if;

  select username,
         coalesce(nullif(save_data->>'premiumGems','')::integer, 0),
         public._coins_of(save_data),
         save_data
    into uname, cur_gems, cur_coins, old_save
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

  -- Belanja coin: client hanya boleh MENGURANGKAN lewat _coinSpend (transient,
  -- tidak ikut tersimpan). Angka absolut coins dari client dibuang.
  spent := case
             when coalesce(merged->>'_coinSpend','') ~ '^[0-9]{1,15}$'
               then (merged->>'_coinSpend')::bigint
             else 0
           end;
  merged := merged - '_coinSpend';
  merged := jsonb_set(merged, '{coins}', to_jsonb(greatest(0, cur_coins - spent)), true);

  -- Inventori ditahan kalau client minta (push ringan saat auto-roll).
  if p_skip_stacks then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  end if;

  update public.player_saves
     set save_data = merged, updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'premiumGems',
    coalesce(nullif(merged->>'premiumGems','')::integer, cur_gems),
    'coins_balance', public._coins_of(merged));
end;
$$;

-- ---------- 9) GRANT ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.claim_story_coins(integer, text)',
    'public.claim_tower_coins(integer)',
    'public.buy_wb_coins()'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- helper internal: jangan pernah bisa dipanggil client
  foreach fn in array array[
    'public._coins_of(jsonb)',
    'public._coin_credit(uuid, bigint)',
    'public._coin_daily_add(text, bigint, integer)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
