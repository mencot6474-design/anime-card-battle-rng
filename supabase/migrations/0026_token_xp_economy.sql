-- 0026_token_xp_economy.sql — Unit 3b: TOKEN (WB/INF) + LEVEL/XP server-authoritative
--
-- Celah sebelum ini: `wbTokens`, `infTokens`, `playerLv`, `xp` semuanya ada di
-- save_data dan merge_player_state menerima seluruh save dari client. F12 cukup
-- menulis state.wbTokens = 999999 (belanja toko WB gratis) atau state.playerLv = 50
-- (buka speed 4x) lalu save().
--
-- Model (sama seperti premiumGems 0023 / coins 0025):
--   * SALDO token hanya berubah di server:
--       - masuk: claim_world_boss_reward (0024, sudah server), claim_tower_tokens (file ini)
--       - keluar: buy_wb_coins (0025), exchange_tokens (0023), spend_tokens (file ini)
--     Nilai absolut `wbTokens`/`infTokens` dari client DIBUANG oleh merge; saldo
--     server yang ditulis balik ke save_data.
--   * LEVEL/XP: client hanya boleh menambah XP sebagai DELTA transient (`_xpGain`,
--     pola sama dengan `_coinSpend` 0025). Server menjumlahkan, membatasi per hari,
--     lalu menghitung level dengan rumus yang sama seperti client:
--     xp per level = lv * 1000, sisa dibawa ke level berikutnya. `playerLv`/`xp`
--     absolut dari client dibuang, termasuk cermin di `player.lv`/`player.exp`.
--   * REGISTER: register_player (0024) dulu menyimpan p_save_data apa adanya, jadi
--     akun BARU bisa membawa saldo palsu yang langsung jadi "saldo server". File
--     ini menormalkan save awal ke freshState (coin 1000, gem 50, token 0, lv 1,
--     xp 0) sebelum insert.
--
-- Batas jujur (dokumentasi, bukan bug):
--   * Battle & roll jalan di client, jadi server tidak bisa MEMBUKTIKAN sebuah stage
--     menang atau satu roll benar-benar terjadi. Yang ditegakkan: nominal tetap per
--     aksi (tower +1/+5 token, xp dari client dibatasi plafon harian), dan item hasil
--     belanja token tetap milik save_data (client). Mengunci saldo token tanpa
--     mengunci inventori memang cuma menaikkan ambang cheat — sama seperti 0025.
--   * `player.sp` (skill tree) TIDAK dikunci: sink-nya ada di client (renderTrait),
--     jadi mengunci sp tanpa mengunci tree tidak menambah keamanan. Level sendiri
--     sudah dikunci, dan level-lah yang membuka speed battle 2x/3x/4x.
--
-- URUTAN DEPLOY: jalankan file ini DULU, lalu push client baru secepatnya.
-- Signature merge_player_state sengaja TIDAK berubah, jadi build lama tetap bisa
-- menulis save (tidak 404) — hanya token & level/xp-nya yang berhenti bertambah
-- sampai client baru terpasang. Jangan dibalik: kalau client baru jalan sebelum
-- migration, semua RPC token baru akan 404.

-- ---------- 1) TABEL LEDGER + HARGA ----------
create table if not exists public.token_daily (
  username text    not null,
  day      date    not null default ((now() at time zone 'utc')::date),
  spent    integer not null default 0,   -- jumlah pembelian item token/hari
  claims   integer not null default 0,   -- jumlah klaim token tower/hari
  earned   bigint  not null default 0,   -- token masuk dari claim_tower_tokens
  primary key (username, day)
);
-- Tabel ini mungkin sudah dibuat versi awal file (tanpa kolom claims): tambahkan
-- tanpa menyentuh baris lama, jadi aman dijalankan ulang.
alter table public.token_daily add column if not exists claims integer not null default 0;

create table if not exists public.xp_daily (
  username text   not null,
  day      date   not null default ((now() at time zone 'utc')::date),
  gained   bigint not null default 0,
  primary key (username, day)
);

-- Harga belanja token = cermin client (raid.js WB_SHOP & tower-lobby.js ITEMS).
-- `gem` dan `coins` TIDAK ada di sini: dua-duanya sudah punya RPC sendiri
-- (exchange_tokens 0023, buy_wb_coins 0025). Kalau harga di client berubah,
-- regenerate tabel ini — kalau tidak, harga di layar beda dengan yang dipotong.
create table if not exists public.token_shop_price (
  source text    not null check (source in ('wb', 'inf')),
  item   text    not null,
  cost   integer not null check (cost > 0),
  primary key (source, item)
);

insert into public.token_shop_price (source, item, cost) values
  ('wb','card_edragon',4000),
  ('wb','card_shadowking',8000),
  ('wb','helm-abyss',12000),
  ('wb','nebula-wisp',30000),
  ('wb','luck1',25),
  ('wb','luck2',125),
  ('wb','luck3',600),
  ('wb','speed1',25),
  ('wb','speed2',125),
  ('wb','speed3',600),
  ('inf','weather',10),
  ('inf','mythic',50),
  ('inf','luck1',10),
  ('inf','luck2',50),
  ('inf','luck3',250),
  ('inf','speed1',10),
  ('inf','speed2',50),
  ('inf','speed3',250)
on conflict (source, item) do update set cost = excluded.cost;

alter table public.token_daily      enable row level security;
alter table public.xp_daily         enable row level security;
alter table public.token_shop_price enable row level security;
revoke all on public.token_daily      from anon, authenticated;
revoke all on public.xp_daily         from anon, authenticated;
revoke all on public.token_shop_price from anon, authenticated;

-- ---------- 2) HELPER INTERNAL ----------
-- Baca integer dari jsonb tanpa pernah melempar 22P02: angka hasil edit save
-- (mis. "1e+21", "abc", negatif) jatuh ke nilai default, bukan mematikan merge.
create or replace function public._int_of(p jsonb, k text, d integer)
returns integer
language sql
immutable
as $$
  select case
           when coalesce(p->>k,'') ~ '^[0-9]{1,9}$' then (p->>k)::integer
           else d
         end;
$$;

create or replace function public._token_of(p jsonb, k text)
returns integer
language sql
immutable
as $$
  select public._int_of(coalesce(p, '{}'::jsonb), k, 0);
$$;

-- ---------- 3) NORMALISASI SATU KALI (sebelum nilai dikunci) ----------
-- Level/xp dulu punya DUA salinan: top-level (`playerLv`/`xp`, dipakai battle &
-- topbar) dan `player.lv`/`player.exp` (dipakai panel profil & roll). Ambil yang
-- terbesar supaya pemain tidak kehilangan progres saat nilainya mulai dikunci.
-- Token negatif (hasil edit save) dijadikan 0.
with base as (
  select user_id,
         greatest(1,
                  public._int_of(save_data, 'playerLv', 1),
                  public._int_of(coalesce(save_data->'player', '{}'::jsonb), 'lv', 1)) as lv,
         greatest(0,
                  public._int_of(save_data, 'xp', 0)::bigint,
                  public._int_of(coalesce(save_data->'player', '{}'::jsonb), 'exp', 0)::bigint) as xp,
         greatest(0, public._int_of(save_data, 'wbTokens', 0))  as wb,
         greatest(0, public._int_of(save_data, 'infTokens', 0)) as inf
    from public.player_saves
   where save_data is not null
)
update public.player_saves p
   set save_data = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               jsonb_set(p.save_data, '{wbTokens}',  to_jsonb(b.wb),  true),
               '{infTokens}', to_jsonb(b.inf), true),
             '{playerLv}', to_jsonb(b.lv), true),
           '{xp}', to_jsonb(b.xp), true),
         '{player}',
         case when jsonb_typeof(p.save_data->'player') = 'object'
              then p.save_data->'player' else '{}'::jsonb end
           || jsonb_build_object('lv', b.lv, 'exp', b.xp), true)
  from base b
 where p.user_id = b.user_id;

-- ---------- 4) RPC: belanja token (WB / INF) ----------
-- Harga diambil dari token_shop_price, bukan dari client. Cek saldo + pemotongan
-- dalam satu UPDATE ... WHERE, jadi dua tab yang beli bersamaan tidak bisa
-- membuat saldo minus. `TOKEN_KURANG` = saldo server tidak cukup.
create or replace function public.spend_tokens(p_source text, p_item text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_buys   constant integer := 1000;   -- pembelian/hari (anti-spam, bukan gate ekonomi)
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_cost   integer;
  v_key    text;
  v_bal    integer;
  v_claims integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_source is null or p_source not in ('wb', 'inf') then
    return jsonb_build_object('ok', false, 'msg', 'BAD_SOURCE');
  end if;
  v_key := case when p_source = 'wb' then 'wbTokens' else 'infTokens' end;

  select cost into v_cost
    from public.token_shop_price
   where source = p_source and item = p_item;
  if v_cost is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_ITEM');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select coalesce(spent, 0) into v_claims
    from public.token_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_claims, 0) + 1 > c_buys then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_buys);
  end if;

  update public.player_saves
     set save_data = jsonb_set(
           coalesce(save_data, '{}'::jsonb), array[v_key]::text[],
           to_jsonb(public._token_of(save_data, v_key) - v_cost), true),
         updated_at = now()
   where user_id = v_uid
     and public._token_of(save_data, v_key) >= v_cost
   returning public._token_of(save_data, v_key) into v_bal;

  if v_bal is null then
    return jsonb_build_object('ok', false, 'msg', 'TOKEN_KURANG');
  end if;

  insert into public.token_daily (username, day, spent)
  values (v_uname, (now() at time zone 'utc')::date, 1)
  on conflict (username, day) do update
     set spent = public.token_daily.spent + 1;

  return jsonb_build_object('ok', true, 'source', p_source, 'item', p_item,
                            'cost', v_cost, 'tokens', v_bal,
                            'wbTokens',  case when p_source = 'wb'  then v_bal end,
                            'infTokens', case when p_source = 'inf' then v_bal end);
end;
$$;

-- ---------- 5) RPC: token INF per lantai Infinite Tower ----------
-- +1 per lantai, +5 per lantai bos (tiap 5) — cermin tower-lobby.js.
-- Tanpa cek urutan lantai (sama seperti claim_tower_coins 0025): run yang sudah
-- jalan saat migration dipasang tidak boleh mendadak kehilangan token. Pembatasnya
-- claim/hari + plafon token/hari.
create or replace function public.claim_tower_tokens(p_floor integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_claims constant integer := 800;
  c_earn   constant bigint  := 5000;
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gain   integer;
  v_claims integer;
  v_earned bigint;
  v_bal    integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  v_gain := case when p_floor % 5 = 0 then 5 else 1 end;

  select coalesce(claims, 0), coalesce(earned, 0) into v_claims, v_earned
    from public.token_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_claims, 0) + 1 > c_claims then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_claims);
  end if;
  if coalesce(v_earned, 0) + v_gain > c_earn then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_earn);
  end if;

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

  return jsonb_build_object('ok', true, 'gained', v_gain,
                            'tokens', v_bal, 'infTokens', v_bal);
end;
$$;

-- ---------- 6) MERGE: token + level/xp tidak lagi dari client ----------
-- Signature SENGAJA sama dengan 0025 (p_save_data, p_allow_gem_decrease,
-- p_skip_stacks) supaya build lama tetap bisa menulis save. Yang berubah hanya
-- badan fungsi: coin (0025) tetap, ditambah kunci token + level/xp dan delta XP.
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
  c_xp_daily constant bigint := 5000000;  -- 100.000 roll/hari: plafon anti-bot, bukan gate
  c_lv_max   constant integer := 9999;
  v_uid     uuid := auth.uid();
  uname     text;
  cur_gems  integer;
  new_gems  integer;
  cur_coins bigint;
  spent     bigint;
  cur_wb    integer;
  cur_inf   integer;
  cur_lv    integer;
  cur_xp    bigint;
  xp_gain   bigint;
  xp_today  bigint;
  new_lv    integer;
  new_xp    bigint;
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
         public._token_of(save_data, 'wbTokens'),
         public._token_of(save_data, 'infTokens'),
         greatest(1, public._int_of(save_data, 'playerLv', 1)),
         greatest(0, public._int_of(save_data, 'xp', 0)::bigint),
         save_data
    into uname, cur_gems, cur_coins, cur_wb, cur_inf, cur_lv, cur_xp, old_save
    from public.player_saves where user_id = v_uid limit 1
    for update;

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

  -- XP: client hanya boleh menambah lewat delta _xpGain (transient). Angka absolut
  -- xp/level dibuang; level dihitung server dengan rumus yang sama seperti client
  -- (xp per level = lv * 1000, sisa dibawa ke level berikutnya).
  xp_gain := case
               when coalesce(merged->>'_xpGain','') ~ '^[0-9]{1,9}$'
                 then (merged->>'_xpGain')::bigint
               else 0
             end;
  merged := merged - '_xpGain';

  select coalesce(gained, 0) into xp_today
    from public.xp_daily
   where username = uname and day = (now() at time zone 'utc')::date;
  xp_gain := least(xp_gain, greatest(0, c_xp_daily - coalesce(xp_today, 0)));

  new_lv := cur_lv;
  new_xp := cur_xp + xp_gain;
  while new_xp >= new_lv::bigint * 1000 and new_lv < c_lv_max loop
    new_xp := new_xp - new_lv::bigint * 1000;
    new_lv := new_lv + 1;
  end loop;

  if xp_gain > 0 then
    insert into public.xp_daily (username, day, gained)
    values (uname, (now() at time zone 'utc')::date, xp_gain)
    on conflict (username, day) do update
       set gained = public.xp_daily.gained + excluded.gained;
  end if;

  -- Token + level/xp: nilai server yang menang (nilai client dibuang).
  merged := jsonb_set(merged, '{wbTokens}', to_jsonb(cur_wb), true);
  merged := jsonb_set(merged, '{infTokens}', to_jsonb(cur_inf), true);
  merged := jsonb_set(merged, '{playerLv}', to_jsonb(new_lv), true);
  merged := jsonb_set(merged, '{xp}', to_jsonb(new_xp), true);
  merged := jsonb_set(merged, '{player}',
    (case when jsonb_typeof(merged->'player') = 'object'
          then merged->'player' else '{}'::jsonb end)
      || jsonb_build_object('lv', new_lv, 'exp', new_xp), true);

  -- Inventori ditahan kalau client minta (push ringan saat auto-roll).
  if p_skip_stacks then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  end if;

  update public.player_saves
     set save_data = merged, updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'premiumGems', coalesce(nullif(merged->>'premiumGems','')::integer, cur_gems),
    'coins_balance', public._coins_of(merged),
    'wbTokens',  cur_wb,
    'infTokens', cur_inf,
    'playerLv',  new_lv,
    'xp',        new_xp,
    'xp_gained', xp_gain);
end;
$$;

-- ---------- 7) REGISTER: save awal tidak boleh membawa saldo/progres ----------
-- register_player (0024) menyimpan p_save_data apa adanya. Tanpa ini, akun BARU
-- bisa mendaftar dengan wbTokens/coins/playerLv palsu dan angka itu langsung
-- menjadi "saldo server" — semua penguncian di atas jadi sia-sia untuk akun itu.
-- Client hanya mengirim freshState(), jadi field di bawah dinormalkan ke nilai
-- awal (sama dengan freshState); field lain (stacks, deck, dst.) tetap diterima.
create or replace function public.register_player(
  p_username text,
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
  v_save  jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_username is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  -- Satu akun Auth = satu save (unique index 0018).
  select username into v_mine from public.player_saves where user_id = v_uid limit 1;
  if v_mine is not null then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', v_mine);
  end if;

  select exists (select 1 from public.player_saves where username = u) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', u);
  end if;

  v_save := coalesce(p_save_data, '{}'::jsonb);
  v_save := jsonb_set(v_save, '{coins}',       to_jsonb(1000), true);  -- freshState
  v_save := jsonb_set(v_save, '{premiumGems}', to_jsonb(50),   true);  -- starter gem
  v_save := jsonb_set(v_save, '{wbTokens}',    to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{infTokens}',   to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{playerLv}',    to_jsonb(1),    true);
  v_save := jsonb_set(v_save, '{xp}',          to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{player}',
    (case when jsonb_typeof(v_save->'player') = 'object'
          then v_save->'player' else '{}'::jsonb end)
      || jsonb_build_object('lv', 1, 'exp', 0), true);
  v_save := v_save - '_coinSpend' - '_xpGain';

  insert into public.player_saves (username, save_data, user_id)
  values (u, v_save, v_uid);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

-- ---------- 8) GRANT ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.spend_tokens(text, text)',
    'public.claim_tower_tokens(integer)',
    'public.register_player(text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- helper internal: jangan pernah bisa dipanggil client
  foreach fn in array array[
    'public._int_of(jsonb, text, integer)',
    'public._token_of(jsonb, text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
