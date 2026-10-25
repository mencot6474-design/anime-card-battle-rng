-- 0028_item_ledger.sql — Unit 3d: kepemilikan pet/artefak server-authoritative + penalti coin
--
-- CELAH yang ditutup (audit 2026-10-25, setelah 0027):
--   1. Beli pet/artefak pakai coin terjadi 100% di client:
--        js/panels.js bpBuyArt/bpBuyPet -> coinSpend(price) -> state.artOwned.push(id)
--      merge_player_state hanya memotong `coins` server sebesar _coinSpend, dan
--      daftar kepemilikan (petOwned/artOwned) diterima apa adanya (0027 cuma
--      memeriksa id-nya dikenal). Jadi F12:
--        state.coins = 1e9; bpBuyArt('intan'); save();
--      -> item permanen, saldo server tinggal 0. Coin jadi gerbang gratis item.
--   2. spend_gems (0024) menulis p_save_data MENTAH dari client. F12 bisa
--      memanggil spend_gems(p_cost => 0, p_save_data => {...save apa pun...})
--      dan menulis coins/stacks/item tanpa bayar. Sekarang spend_gems memotong
--      gem di server lalu meneruskan save lewat merge (semua guard berlaku).
--
-- MODEL BARU:
--   * public.item_def   = harga & sumber item, cermin js/data.js (PET_DEFS/ART_DEFS).
--   * public.player_items = SATU-SATUNYA sumber kepemilikan pet/artefak.
--     Backfill di bawah memasukkan item yang sudah dimiliki sebelum migration.
--   * Beli coin/gem  -> RPC buy_item(p_item_id) (harga dari item_def, atomik).
--   * Beli token     -> spend_tokens (0026) sekarang mencatat ledger.
--   * Drop tower     -> tetap client-trust (RNG di client, sama seperti 0027),
--     dicatat source 'tower' saat merge.
--   * merge membangun petOwned/artOwned dari ledger. Item berbayar yang tidak
--     ada di ledger = percobaan curang -> item dibuang, COIN DI-RESET 0, dan
--     kejadiannya dicatat di public.item_penalty.
--   * Jalur beli lama (client cache yang belum update) tetap dilayani: item coin
--     diterima kalau harga tertutup _coinSpend push itu (jadi tetap bayar).
--     Item gem lama dicatat oleh spend_gems kalau harganya tertutup p_cost.
--
-- SISA RISIKO (disengaja): rollPacks/weather dari toko premium masih field save
-- yang dikirim client (merge belum punya tabel harganya) — beda unit, bukan coin.

-- ---------- 1) HARGA ITEM (cermin js/data.js) ----------
-- Regenerate kalau PET_DEFS/ART_DEFS berubah: node _tmp/gen_0028.cjs
create table if not exists public.item_def (
  id         text    primary key,
  kind       text    not null check (kind in ('pet', 'art')),
  coin_price bigint  not null default 0 check (coin_price >= 0),
  gem_price  integer not null default 0 check (gem_price >= 0),
  src        text    not null check (src in ('coin', 'gem', 'raid', 'tower'))
);

insert into public.item_def (id, kind, coin_price, gem_price, src) values
  ('doll', 'pet', 10000000, 0, 'coin'),
  ('otherworldly', 'pet', 20000000, 0, 'coin'),
  ('titan', 'pet', 35000000, 0, 'coin'),
  ('dragon', 'pet', 50000000, 0, 'coin'),
  ('nine-tail', 'pet', 70000000, 0, 'coin'),
  ('bijuu', 'pet', 100000000, 0, 'coin'),
  ('kyubi', 'pet', 0, 0, 'tower'),
  ('nebula-wisp', 'pet', 0, 0, 'raid'),
  ('next-bot', 'pet', 5000000000, 0, 'coin'),
  ('cyber-kitsune', 'pet', 0, 10000, 'gem'),
  ('manik', 'art', 10000000, 0, 'coin'),
  ('medal', 'art', 20000000, 0, 'coin'),
  ('giok', 'art', 35000000, 0, 'coin'),
  ('batu', 'art', 50000000, 0, 'coin'),
  ('cincin', 'art', 70000000, 0, 'coin'),
  ('intan', 'art', 100000000, 0, 'coin'),
  ('pedang-api', 'art', 0, 0, 'tower'),
  ('helm-abyss', 'art', 0, 0, 'raid'),
  ('tameng-surgawi', 'art', 1000000000, 0, 'coin'),
  ('tome-infinity', 'art', 0, 3000, 'gem')
on conflict (id) do update
  set kind = excluded.kind,
      coin_price = excluded.coin_price,
      gem_price  = excluded.gem_price,
      src        = excluded.src;

-- ---------- 2) LEDGER KEPEMILIKAN ----------
create table if not exists public.player_items (
  username   text        not null,
  item_id    text        not null references public.item_def (id) on delete cascade,
  kind       text        not null check (kind in ('pet', 'art')),
  source     text        not null check (source in ('coin', 'gem', 'raid', 'tower', 'legacy')),
  paid       bigint      not null default 0,
  created_at timestamptz not null default now(),
  primary key (username, item_id)
);
create index if not exists idx_player_items_user on public.player_items (username, kind);

-- Audit penalti: siapa, kapan, alasan, berapa coin yang dihapus, item apa saja.
create table if not exists public.item_penalty (
  id           bigserial   primary key,
  username     text        not null,
  day          date        not null default ((now() at time zone 'utc')::date),
  reason       text        not null,
  coins_zeroed bigint      not null default 0,
  items        jsonb       not null default '[]'::jsonb,
  at           timestamptz not null default now()
);

alter table public.item_def       enable row level security;
alter table public.player_items   enable row level security;
alter table public.item_penalty   enable row level security;
revoke all on public.item_def     from anon, authenticated;
revoke all on public.player_items from anon, authenticated;
revoke all on public.item_penalty from anon, authenticated;
revoke all on public.item_penalty_id_seq from anon, authenticated;

-- ---------- 3) BACKFILL: item yang sudah dimiliki sebelum ledger dianggap SAH ----------
-- Tidak bisa dibedakan lagi mana yang dibeli jujur dan mana hasil F12 sebelum
-- migration ini; memilih tidak menghukum pemain lama (tidak ada yang hilang).
insert into public.player_items (username, item_id, kind, source, paid)
select p.username, d.id, d.kind, 'legacy', 0
  from public.player_saves p
  cross join lateral (
    select e.v #>> '{}' as id
      from jsonb_array_elements(
             case when jsonb_typeof(p.save_data->'petOwned') = 'array'
                  then p.save_data->'petOwned' else '[]'::jsonb end) as e(v)
    union
    select e.v #>> '{}'
      from jsonb_array_elements(
             case when jsonb_typeof(p.save_data->'artOwned') = 'array'
                  then p.save_data->'artOwned' else '[]'::jsonb end) as e(v)
  ) c
  join public.item_def d on d.id = c.id
on conflict do nothing;

-- ---------- 4) HELPER INTERNAL ----------
create or replace function public._items_of(p_uname text, p_kind text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item_id order by item_id), '[]'::jsonb)
    from public.player_items
   where username = p_uname and kind = p_kind;
$$;

-- Klaim daftar item dari client terhadap ledger. Mengembalikan
-- {kept, stripped, unknown, used}. `stripped` = item berbayar yang TIDAK
-- tertutup pembayaran apa pun (indikasi curang); `unknown` = id tak dikenal.
create or replace function public._claim_items(
  p_uname   text,
  p_claimed jsonb,
  p_kind    text,
  p_budget  bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     text;
  v_def    public.item_def%rowtype;
  v_budget bigint := greatest(0, coalesce(p_budget, 0));
  v_used   bigint := 0;
  v_kept   jsonb  := '[]'::jsonb;
  v_strip  jsonb  := '[]'::jsonb;
  v_unk    jsonb  := '[]'::jsonb;
begin
  if p_uname is null or p_kind is null or p_kind not in ('pet', 'art') then
    return jsonb_build_object('kept', '[]'::jsonb, 'stripped', '[]'::jsonb,
                              'unknown', '[]'::jsonb, 'used', 0);
  end if;

  -- Klaim kosong / bukan array = client tidak mengirim daftar (bukan berarti
  -- "tidak punya item"). Pakai ledger apa adanya supaya item tidak pernah
  -- terhapus karena payload yang tidak lengkap.
  if p_claimed is null
     or jsonb_typeof(p_claimed) <> 'array'
     or jsonb_array_length(p_claimed) = 0 then
    return jsonb_build_object('kept', public._items_of(p_uname, p_kind),
                              'stripped', '[]'::jsonb,
                              'unknown', '[]'::jsonb, 'used', 0);
  end if;

  for v_id in
    select q.id
      from (
        select distinct on (e.v #>> '{}') e.v #>> '{}' as id, e.ord
          from jsonb_array_elements(
                 case when jsonb_typeof(p_claimed) = 'array'
                      then p_claimed else '[]'::jsonb end)
               with ordinality as e(v, ord)
         where jsonb_typeof(e.v) = 'string'
           and length(e.v #>> '{}') <= 64
         order by e.v #>> '{}', e.ord
      ) q
     order by q.ord
     limit 200
  loop
    select * into v_def from public.item_def where id = v_id and kind = p_kind;
    if not found then
      v_unk := v_unk || to_jsonb(v_id);
      continue;
    end if;

    if exists (select 1 from public.player_items pi
                where pi.username = p_uname and pi.item_id = v_id) then
      v_kept := v_kept || to_jsonb(v_id);
      continue;
    end if;

    if v_def.src = 'tower' then
      insert into public.player_items (username, item_id, kind, source, paid)
      values (p_uname, v_id, p_kind, 'tower', 0)
      on conflict do nothing;
      v_kept := v_kept || to_jsonb(v_id);
    elsif v_def.src = 'coin' and v_def.coin_price > 0 and v_def.coin_price <= v_budget then
      insert into public.player_items (username, item_id, kind, source, paid)
      values (p_uname, v_id, p_kind, 'coin', v_def.coin_price)
      on conflict do nothing;
      v_budget := v_budget - v_def.coin_price;
      v_used   := v_used + v_def.coin_price;
      v_kept   := v_kept || to_jsonb(v_id);
    else
      v_strip := v_strip || to_jsonb(v_id);
    end if;
  end loop;

  return jsonb_build_object('kept', v_kept, 'stripped', v_strip,
                            'unknown', v_unk, 'used', v_used);
end;
$$;

-- ---------- 5) RPC: beli item (coin / gem) ----------
-- Harga dari item_def, bukan dari client. Potong saldo + catat ledger dalam
-- satu transaksi; dua tab yang membeli bersamaan tidak bisa membuat saldo minus.
create or replace function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_def   public.item_def%rowtype;
  v_bal   bigint;
  v_gems  integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  select * into v_def from public.item_def where id = p_item_id;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'BAD_ITEM');
  end if;
  if v_def.src not in ('coin', 'gem') then
    return jsonb_build_object('ok', false, 'msg', 'NOT_SOLD_HERE', 'src', v_def.src);
  end if;

  if exists (select 1 from public.player_items
              where username = v_uname and item_id = p_item_id) then
    select public._coins_of(save_data), public._int_of(save_data, 'premiumGems', 0)
      into v_bal, v_gems
      from public.player_saves where user_id = v_uid;
    return jsonb_build_object('ok', true, 'already', true, 'item_id', p_item_id,
      'kind', v_def.kind, 'coins_balance', coalesce(v_bal, 0),
      'premiumGems', coalesce(v_gems, 0),
      'petOwned', public._items_of(v_uname, 'pet'),
      'artOwned', public._items_of(v_uname, 'art'));
  end if;

  if v_def.coin_price > 0 then
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{coins}',
             to_jsonb(public._coins_of(coalesce(save_data, '{}'::jsonb)) - v_def.coin_price), true),
           updated_at = now()
     where user_id = v_uid
       and public._coins_of(coalesce(save_data, '{}'::jsonb)) >= v_def.coin_price
     returning public._coins_of(save_data) into v_bal;
    if v_bal is null then
      select public._coins_of(save_data) into v_bal
        from public.player_saves where user_id = v_uid;
      return jsonb_build_object('ok', false, 'msg', 'COIN_KURANG',
                                'coins_balance', coalesce(v_bal, 0), 'cost', v_def.coin_price);
    end if;
  else
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
             to_jsonb(public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) - v_def.gem_price), true),
           updated_at = now()
     where user_id = v_uid
       and public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) >= v_def.gem_price
     returning public._int_of(save_data, 'premiumGems', 0) into v_gems;
    if v_gems is null then
      select public._int_of(save_data, 'premiumGems', 0) into v_gems
        from public.player_saves where user_id = v_uid;
      return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                                'premiumGems', coalesce(v_gems, 0), 'cost', v_def.gem_price);
    end if;
  end if;

  insert into public.player_items (username, item_id, kind, source, paid)
  values (v_uname, p_item_id, v_def.kind,
          case when v_def.coin_price > 0 then 'coin' else 'gem' end,
          greatest(v_def.coin_price, v_def.gem_price))
  on conflict do nothing;

  select public._coins_of(save_data), public._int_of(save_data, 'premiumGems', 0)
    into v_bal, v_gems
    from public.player_saves where user_id = v_uid;

  return jsonb_build_object('ok', true, 'item_id', p_item_id, 'kind', v_def.kind,
    'coins_balance', coalesce(v_bal, 0), 'premiumGems', coalesce(v_gems, 0),
    'petOwned', public._items_of(v_uname, 'pet'),
    'artOwned', public._items_of(v_uname, 'art'));
end;
$$;

-- ---------- 6) spend_gems: potong gem di server, save lewat merge ----------
-- Signature TIDAK berubah (client lama tetap jalan), tapi p_save_data tidak lagi
-- ditulis mentah. p_allow_gem_decrease tidak dipakai lagi (pemotongan dilakukan
-- di sini); dipertahankan demi kompatibilitas signature.
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
  v_uid   uuid := auth.uid();
  v_uname text;
  v_gems  integer;
  v_res   jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'BAD_INPUT';
  end if;

  select username, public._int_of(save_data, 'premiumGems', 0)
    into v_uname, v_gems
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if v_gems < p_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', v_gems, 'cost', p_cost);
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
           to_jsonb(v_gems - p_cost), true),
         updated_at = now()
   where user_id = v_uid;

  -- Item gem (pet/artefak premium) yang harganya tertutup p_cost dicatat ke
  -- ledger. Tanpa catatan, merge akan membuangnya — jadi F12 yang memanggil
  -- spend_gems(p_cost => 0) tidak mendapat item apa pun.
  insert into public.player_items (username, item_id, kind, source, paid)
  select v_uname, d.id, d.kind, 'gem', d.gem_price
    from public.item_def d
   where d.src = 'gem'
     and d.gem_price > 0
     and d.gem_price <= p_cost
     and (
       exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(coalesce(p_save_data, '{}'::jsonb)->'petOwned') = 'array'
                then p_save_data->'petOwned' else '[]'::jsonb end) as e(v)
          where e.v #>> '{}' = d.id)
       or exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(coalesce(p_save_data, '{}'::jsonb)->'artOwned') = 'array'
                then p_save_data->'artOwned' else '[]'::jsonb end) as e(v)
          where e.v #>> '{}' = d.id)
     )
  on conflict do nothing;

  v_res := public.merge_player_state(coalesce(p_save_data, '{}'::jsonb), false, false);

  if v_res is null or coalesce((v_res->>'ok')::boolean, false) is not true then
    -- merge menolak: kembalikan gem supaya tidak hangus.
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
             to_jsonb(public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) + p_cost), true),
           updated_at = now()
     where user_id = v_uid;
    return coalesce(v_res, jsonb_build_object('ok', false, 'msg', 'MERGE_FAIL'));
  end if;

  return jsonb_build_object('ok', true,
    'balance', coalesce((v_res->>'premiumGems')::integer, v_gems - p_cost),
    'cost', p_cost);
end;
$$;

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

  -- 0028: item pet/artefak yang dibeli pakai token dicatat ke ledger server,
  -- supaya merge berikutnya tidak membuangnya (kepemilikan = ledger).
  insert into public.player_items (username, item_id, kind, source, paid)
  select v_uname, d.id, d.kind, 'raid', v_cost
    from public.item_def d
   where d.id = p_item and d.src = 'raid'
  on conflict do nothing;

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
  c_xp_daily  constant bigint  := 5000000;   -- plafon anti-bot (bukan gate)
  c_reb_daily constant bigint  := 50000000;  -- essence rebirth/hari
  c_lv_max    constant integer := 9999;
  c_reb_max   constant integer := 40;        -- 2^40 x 1e6 masih muat bigint
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
  v_player  jsonb;
  cur_lb    numeric;
  cur_lf    numeric;
  cur_lp    numeric;
  cur_legacy integer;
  cur_tree  jsonb;
  cur_tree_cost integer;
  new_tree  jsonb;
  sp_budget integer;
  new_sp    integer;
  cur_reb_count integer;
  cur_reb_ess   numeric;
  new_reb_count integer;
  new_reb_ess   numeric;
  reb_gain  numeric;
  reb_today bigint;
  reb_do    boolean;
  v_want    integer;
  v_thr     numeric;
  v_id      text;
  v_s1      text;
  v_s2      text;
  v_today   date := (now() at time zone 'utc')::date;
  -- 0028: penalti + ledger item
  c_coin_pending constant bigint := 5000000;  -- toleransi coin "menunggu push"
  v_claim_coins bigint;
  v_new_coins   bigint;
  v_budget      bigint;
  v_pet         jsonb;
  v_art         jsonb;
  v_stripped    jsonb;
  v_penalty     text;
  v_pen_items   jsonb;
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
         coalesce(sp_legacy, 0),
         save_data
    into uname, cur_gems, cur_coins, cur_wb, cur_inf, cur_lv, cur_xp, cur_legacy, old_save
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

  -- Belanja coin: client hanya boleh MENGURANGKAN lewat _coinSpend (transient).
  spent := case
             when coalesce(merged->>'_coinSpend','') ~ '^[0-9]{1,15}$'
             then (merged->>'_coinSpend')::bigint
             else 0
           end;
  merged := merged - '_coinSpend';

  -- 0028 PENALTI COIN: angka `coins` absolut dari client memang selalu dibuang,
  -- tapi kalau client mengaku punya coin jauh di atas saldo server itu bukan save
  -- basi — itu hasil edit F12. Saldo di-reset 0 (hukuman, bukan koreksi).
  -- Toleransi 5 jt = jauh di atas satu reward sah yang masih menunggu push
  -- (first clear story terbesar 320rb x rw 4,5 = 1,44 jt; tower maks 600rb),
  -- jadi pemain jujur tidak mungkin kena.
  v_claim_coins := case
                     when coalesce(p_save_data->>'coins','') ~ '^[0-9]{1,15}$'
                     then (p_save_data->>'coins')::bigint
                   end;
  if v_claim_coins is not null and v_claim_coins > cur_coins + c_coin_pending then
    v_penalty   := 'COIN_INFLATE';
    v_pen_items := jsonb_build_array('coins:' || v_claim_coins);
  end if;

  -- XP: delta transient, angka absolut dibuang; level dihitung server.
  xp_gain := case
               when coalesce(merged->>'_xpGain','') ~ '^[0-9]{1,9}$'
               then (merged->>'_xpGain')::bigint
               else 0
             end;
  merged := merged - '_xpGain';

  select coalesce(gained, 0) into xp_today
    from public.xp_daily
   where username = uname and day = v_today;
  xp_gain := least(xp_gain, greatest(0, c_xp_daily - coalesce(xp_today, 0)));

  new_lv := cur_lv;
  new_xp := cur_xp + xp_gain;
  while new_xp >= new_lv::bigint * 1000 and new_lv < c_lv_max loop
    new_xp := new_xp - new_lv::bigint * 1000;
    new_lv := new_lv + 1;
  end loop;

  if xp_gain > 0 then
    insert into public.xp_daily (username, day, gained)
    values (uname, v_today, xp_gain)
    on conflict (username, day) do update
      set gained = public.xp_daily.gained + excluded.gained;
  end if;

  -- REBIRTH: nilai absolut dibuang. Client 0027+ mengirim delta _rebirthGain
  -- dan flag _rebirthDo; client lama (tanpa dua key itu) memakai jalur legacy
  -- yang tetap dibatasi: essence naik maksimal plafon harian, count maksimal +1
  -- per push dan hanya kalau essence server cukup untuk ambangnya.
  cur_reb_count := least(c_reb_max, greatest(0, public._int_of(coalesce(old_save->'rebirth','{}'::jsonb), 'count', 0)));
  cur_reb_ess   := greatest(0, public._num_of(coalesce(old_save->'rebirth','{}'::jsonb), 'essence', 0));

  reb_gain := 0;
  reb_do   := false;
  v_want   := cur_reb_count;

  if merged ? '_rebirthGain' or merged ? '_rebirthDo' then
    reb_gain := greatest(0, public._num_of(merged, '_rebirthGain', 0));
    reb_do   := lower(coalesce(merged->>'_rebirthDo','')) in ('true','1');
    if reb_do then v_want := cur_reb_count + 1; end if;
  else
    reb_gain := greatest(0, public._num_of(coalesce(merged->'rebirth','{}'::jsonb), 'essence', 0) - cur_reb_ess);
    v_want   := greatest(cur_reb_count, least(cur_reb_count + 1,
                  public._int_of(coalesce(merged->'rebirth','{}'::jsonb), 'count', cur_reb_count)));
  end if;
  merged := merged - '_rebirthGain' - '_rebirthDo';

  select coalesce(gained, 0) into reb_today
    from public.rebirth_daily
   where username = uname and day = v_today;
  reb_gain := least(reb_gain, greatest(0, c_reb_daily - coalesce(reb_today, 0)));

  new_reb_ess   := cur_reb_ess + reb_gain;
  new_reb_count := cur_reb_count;

  if v_want > cur_reb_count and new_reb_count < c_reb_max then
    v_thr := round(1000000 * power(2, new_reb_count));
    if new_reb_ess >= v_thr then
      new_reb_ess   := new_reb_ess - v_thr;
      new_reb_count := new_reb_count + 1;
    end if;
  end if;

  if reb_gain > 0 then
    insert into public.rebirth_daily (username, day, gained)
    values (uname, v_today, reb_gain)
    on conflict (username, day) do update
      set gained = public.rebirth_daily.gained + excluded.gained;
  end if;
  merged := jsonb_set(merged, '{rebirth}',
    jsonb_build_object('count', new_reb_count, 'essence', new_reb_ess), true);

  -- Token + level/xp: nilai server yang menang.
  merged := jsonb_set(merged, '{wbTokens}',  to_jsonb(cur_wb),  true);
  merged := jsonb_set(merged, '{infTokens}', to_jsonb(cur_inf), true);
  merged := jsonb_set(merged, '{playerLv}',  to_jsonb(new_lv),  true);
  merged := jsonb_set(merged, '{xp}',        to_jsonb(new_xp),  true);

  -- INVENTORI: bersihkan entri mustahil / dobel. Saat push ringan (auto-roll)
  -- server tetap memakai stacks lama, jadi validasi deck juga ditunda.
  if p_skip_stacks or not (merged ? 'stacks') then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  else
    merged := jsonb_set(merged, '{stacks}', public._clean_stacks(merged->'stacks'), true);
  end if;
  if not p_skip_stacks then
    merged := jsonb_set(merged, '{deck}',
      public._clean_deck(merged->'deck', merged->'stacks'), true);
    merged := jsonb_set(merged, '{equippedId}',
      public._clean_equip(merged->>'equippedId', merged->'stacks'), true);
    merged := jsonb_set(merged, '{equippedId2}',
      public._clean_equip(merged->>'equippedId2', merged->'stacks'), true);
  end if;

  -- PET / ARTEFAK (0028): kepemilikan dibangun dari ledger server
  -- (public.player_items), BUKAN dari daftar kiriman client. Item yang belum
  -- tercatat hanya diterima kalau harga coin-nya tertutup sisa _coinSpend push
  -- ini (jalur beli lama) atau source-nya 'tower' (drop RNG, sudah client-trust
  -- sejak 0027). Selain itu dibuang dan dicatat sebagai pelanggaran.
  -- Anggaran = min(spend, saldo server): coin yang tidak ada di server tidak
  -- bisa dipakai membayar item.
  v_budget := least(spent, cur_coins);
  v_pet    := public._claim_items(uname, merged->'petOwned', 'pet', v_budget);
  v_budget := greatest(0, v_budget - coalesce((v_pet->>'used')::bigint, 0));
  v_art    := public._claim_items(uname, merged->'artOwned', 'art', v_budget);

  merged := jsonb_set(merged, '{petOwned}', coalesce(v_pet->'kept', '[]'::jsonb), true);
  merged := jsonb_set(merged, '{artOwned}', coalesce(v_art->'kept', '[]'::jsonb), true);

  v_stripped := coalesce(v_pet->'stripped', '[]'::jsonb) || coalesce(v_art->'stripped', '[]'::jsonb);
  if jsonb_array_length(v_stripped) > 0 and v_penalty is null then
    v_penalty   := 'ITEM_NOT_PAID';
    v_pen_items := v_stripped;
  end if;

  -- Saldo coin final: delta belanja, atau 0 kalau kena penalti.
  v_new_coins := case when v_penalty is null then greatest(0, cur_coins - spent) else 0 end;
  merged := jsonb_set(merged, '{coins}', to_jsonb(v_new_coins), true);

  if v_penalty is not null then
    insert into public.item_penalty (username, reason, coins_zeroed, items)
    values (uname, v_penalty, greatest(0, cur_coins), coalesce(v_pen_items, '[]'::jsonb));
  end if;

  v_id := merged->>'petEquipped';
  if v_id is null or not exists (
       select 1 from jsonb_array_elements_text(merged->'petOwned') o where o = v_id)
  then
    merged := jsonb_set(merged, '{petEquipped}', 'null'::jsonb, true);
  end if;

  v_s1 := null;
  v_s2 := null;
  select o into v_s1 from jsonb_array_elements_text(merged->'artOwned') o
   where o = coalesce(merged->'artSlots'->>0, '') limit 1;
  select o into v_s2 from jsonb_array_elements_text(merged->'artOwned') o
   where o = coalesce(merged->'artSlots'->>1, '') and o is distinct from v_s1 limit 1;
  merged := jsonb_set(merged, '{artSlots}', jsonb_build_array(v_s1, v_s2), true);

  -- LUCK + SKILL TREE: luckBase/Flat/Percent tidak punya jalur tulis legit di
  -- client (semuanya dihitung dari tree/pet/artefak saat render), jadi nilainya
  -- dikunci ke server. Tree divalidasi terhadap anggaran SP = level - 1; kalau
  -- tidak valid, tree lama dipertahankan (bukan dihapus).
  v_player := case when jsonb_typeof(merged->'player') = 'object'
                   then merged->'player' else '{}'::jsonb end;
  cur_lb := least(100, greatest(1, public._num_of(coalesce(old_save->'player','{}'::jsonb), 'luckBase', 1)));
  cur_lf := least(1000000, greatest(0, public._num_of(coalesce(old_save->'player','{}'::jsonb), 'luckFlat', 0)));
  cur_lp := least(1000000, greatest(0, public._num_of(coalesce(old_save->'player','{}'::jsonb), 'luckPercent', 0)));
  cur_tree := case when jsonb_typeof(old_save->'player'->'tree') = 'object'
                   then old_save->'player'->'tree' else '{}'::jsonb end;
  cur_tree_cost := public._tree_cost(cur_tree);

  new_tree := case when jsonb_typeof(v_player->'tree') = 'object'
                   then v_player->'tree' else '{}'::jsonb end;
  sp_budget := greatest(0, (new_lv - 1) + cur_legacy);
  if not public._tree_ok(new_tree, sp_budget) then
    new_tree := cur_tree;
  end if;
  new_sp := greatest(0, sp_budget - public._tree_cost(new_tree));

  merged := jsonb_set(merged, '{player}',
    v_player || jsonb_build_object(
      'lv', new_lv, 'exp', new_xp, 'sp', new_sp, 'tree', new_tree,
      'luckBase', cur_lb, 'luckFlat', cur_lf, 'luckPercent', cur_lp), true);

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
    'xp_gained', xp_gain,
    'rebirth_count',   new_reb_count,
    'rebirth_essence', new_reb_ess,
    'rebirth_gained',  reb_gain,
    'penalty', v_penalty,
    'petOwned', coalesce(merged->'petOwned', '[]'::jsonb),
    'artOwned', coalesce(merged->'artOwned', '[]'::jsonb),
    'petEquipped', merged->'petEquipped',
    'artSlots', coalesce(merged->'artSlots', '[null,null]'::jsonb));
end;
$$;

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
  v_stacks jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_username is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

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
  v_save := jsonb_set(v_save, '{rebirth}',     '{"count":0,"essence":0}'::jsonb, true);

  -- Inventori awal: starter card sah, sisanya dibersihkan seperti merge.
  v_stacks := public._clean_stacks(v_save->'stacks');
  v_save := jsonb_set(v_save, '{stacks}', v_stacks, true);
  v_save := jsonb_set(v_save, '{deck}', public._clean_deck(v_save->'deck', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId}',  public._clean_equip(v_save->>'equippedId', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId2}', public._clean_equip(v_save->>'equippedId2', v_stacks), true);
  -- 0028: akun baru tidak mewarisi item dari payload (ledger-nya masih kosong).
  v_save := jsonb_set(v_save, '{petOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{artOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{petEquipped}', 'null'::jsonb, true);
  v_save := jsonb_set(v_save, '{artSlots}', '[null,null]'::jsonb, true);

  v_save := jsonb_set(v_save, '{player}',
    (case when jsonb_typeof(v_save->'player') = 'object'
          then v_save->'player' else '{}'::jsonb end)
      || jsonb_build_object('lv', 1, 'exp', 0, 'sp', 0, 'tree', '{}'::jsonb,
                            'luckBase', 1, 'luckFlat', 0, 'luckPercent', 0), true);
  v_save := v_save - '_coinSpend' - '_xpGain' - '_rebirthGain' - '_rebirthDo';

  insert into public.player_saves (username, save_data, user_id)
  values (u, v_save, v_uid);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

-- ---------- 7) GRANT ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merge_player_state(jsonb, boolean, boolean)',
    'public.register_player(text, jsonb)',
    'public.spend_gems(integer, boolean, jsonb)',
    'public.spend_tokens(text, text)',
    'public.buy_item(text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- helper internal: jangan pernah bisa dipanggil client
  foreach fn in array array[
    'public._items_of(text, text)',
    'public._claim_items(text, jsonb, text, bigint)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
