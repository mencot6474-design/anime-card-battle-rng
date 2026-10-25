-- 0029_tamper_guard.sql — Unit 3e: deteksi & NOL-KAN nilai save yang bisa diubah lewat F12
--
-- AUDIT (2026-10-26, setelah 0028). Semua RPC tulis sudah JWT-only, tapi token
-- sesi itu milik pemain sendiri (localStorage `aab-auth-sess` + anon key publik
-- di js/config.js). Jadi "hacker amatir" cukup buka console lalu memanggil RPC
-- atau menulis field save. Daftar field yang MASIH client-trust dan penanganannya
-- di migration ini:
--
--   FIELD (jalur F12)                    | DETEKSI                          | AKSI
--   -------------------------------------|----------------------------------|----------------------
--   claim_story_* / claim_tower_*        | progres tidak berurutan          | klaim DITOLAK (0 bayaran)
--   (klaim hadiah tanpa pernah main)     | (frontier server +1)             | + tamper_log CLAIM_UNREACHABLE
--   rollPacks (pack instan)              | ledger player_packs + jatah      | kelebihan -> 0 (PACK_INFLATE)
--   weather / weatherBest                | id tak dikenal / endsAt > 31 mnt | -> null (WEATHER_TAMPER)
--   potions / luckPots / speedPots /     | plafon 200 + 2x klaim tower      | slot -> 0 (POT_INFLATE)
--   mythicPotions                        |                                  |
--   cleared / clearedDiff                | stage di luar frontier klaim     | entri -> dibuang
--                                        |                                  | (PROGRESS_FAKE)
--   pub / playSec / customAvatar / titles| angka mustahil, URL bukan data:, | field -> null/0
--                                        | playSec melompat > waktu nyata   | (PUB_TAMPER/PLAY_INFLATE)
--   _xpGain (delta XP)                   | > 200rb per push                 | kelebihan -> 0 (XP_DELTA)
--   premiumGems / wbTokens / infTokens / | klaim client > nilai server      | klaim dibuang (server menang)
--   playerLv / xp                        |                                  | (GEM_INFLATE/TOKEN_INFLATE/...)
--   submit_leaderboard_score p_value     | > plafon papan                   | submit DITOLAK (LB_INFLATE)
--
-- FILOSOFI: nilai yang diinspect tidak dipakai sama sekali. Kalau nilainya masih
-- masuk akal (mis. jumlah pack yang masih tertutup jatah tower), dipakai versi
-- server; kalau melewati bukti server, nilainya jadi 0 dan kejadiannya dicatat
-- di public.tamper_log. Tidak ada penalti finansial baru (coin sudah di 0028).
--
-- SISA RISIKO (disengaja, beda unit):
--   * Isi kartu di `stacks` TIDAK dipolisikan di sini. `_clean_stacks` (0027)
--     sudah men-dedup per (char, mut, shiny) sehingga maksimum 1050 varian, dan
--     semua varian itu SAH bisa dicapai pemain yang sudah roll puluhan ribu
--     kali. Rasio shiny/mut tidak bisa dipakai sebagai bukti tanpa roll ledger
--     di server (Unit 4) — memaksakannya akan menghapus kartu pemain jujur.
--   * deck_power/rarest_pull masih memakai angka client yang dipotong plafon
--     papan; hitung ulang penuh dari stacks butuh tabel rarity/power (Unit 5).
--
-- URUTAN DEPLOY: jalankan file ini DULU, baru push client. Klien lama tetap
-- jalan (signature tidak berubah) tetapi pack yang dibeli lewat cache lama bisa
-- di-nol-kan; jalur legacy di spend_gems menutup kasus normal (harga persis).

-- ============================================================
-- 1) LOG PELANGGARAN
-- ============================================================
create table if not exists public.tamper_log (
  id       bigserial   primary key,
  username text        not null,
  day      date        not null default ((now() at time zone 'utc')::date),
  reason   text        not null,
  field    text        not null,
  claimed  text,
  allowed  text,
  detail   jsonb       not null default '{}'::jsonb,
  at       timestamptz not null default now()
);
create index if not exists idx_tamper_log_user on public.tamper_log (username, at desc);

alter table public.tamper_log enable row level security;
revoke all on public.tamper_log from anon, authenticated;
revoke all on public.tamper_log_id_seq from anon, authenticated;

create or replace function public._tamper(
  p_uname   text,
  p_reason  text,
  p_field   text,
  p_claimed text,
  p_allowed text,
  p_detail  jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uname is null or p_reason is null or p_field is null then
    return;
  end if;
  insert into public.tamper_log (username, reason, field, claimed, allowed, detail)
  values (p_uname, p_reason, p_field, left(coalesce(p_claimed, ''), 200),
          left(coalesce(p_allowed, ''), 200), coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- ============================================================
-- 2) CERMIN KECIL (regenerate kalau client berubah)
--    weather_def <- WEATHERS (js/panels.js:18)
--    pack_def    <- PREMIUM_PACKS type 'pack' (js/panels.js:1773)
-- ============================================================
create table if not exists public.weather_def (
  id text primary key
);
insert into public.weather_def (id) values
  ('awakened'), ('arcane'), ('goofy'), ('glitch'), ('doodle'), ('eclipse'),
  ('iceage'), ('galactic'), ('aurora'), ('monsoon'),
  ('sandstorm'), ('thunderstorm'), ('snowfall'), ('lightrain'), ('windy')
on conflict (id) do nothing;

create table if not exists public.pack_def (
  id         text    primary key,
  gems       integer not null check (gems > 0),
  tower_rate numeric not null default 0 check (tower_rate >= 0)
);
alter table public.pack_def add column if not exists tower_rate numeric not null default 0;
insert into public.pack_def (id, gems, tower_rate) values
  ('r5k', 25, 0.15), ('r10k', 50, 0.06), ('r25k', 100, 0.03),
  ('r50k', 150, 0), ('r100k', 250, 0.015)
on conflict (id) do update
  set gems = excluded.gems, tower_rate = excluded.tower_rate;

alter table public.weather_def enable row level security;
alter table public.pack_def    enable row level security;
revoke all on public.weather_def from anon, authenticated;
revoke all on public.pack_def    from anon, authenticated;

-- ============================================================
-- 3) LEDGER PACK + JATAH
--    player_packs = satu-satunya sumber jumlah pack instan.
--    Jatah per pack = drop tower (rate di pack_def x total klaim lantai) +
--    hadiah World Boss (leaderboard_claims.packs, selalu r100k). `used` dicatat
--    per pack supaya jatah tidak bisa dipakai dua kali.
-- ============================================================
create table if not exists public.player_packs (
  username text    not null,
  pack     text    not null references public.pack_def (id) on delete cascade,
  qty      integer not null default 0 check (qty >= 0),
  primary key (username, pack)
);

create table if not exists public.pack_allowance (
  username text    not null,
  pack     text    not null references public.pack_def (id) on delete cascade,
  used     integer not null default 0 check (used >= 0),
  primary key (username, pack)
);

alter table public.player_packs   enable row level security;
alter table public.pack_allowance enable row level security;
revoke all on public.player_packs   from anon, authenticated;
revoke all on public.pack_allowance from anon, authenticated;

create or replace function public._pack_allowance_for(p_uname text, p_pack text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(
    floor(coalesce((select sum(claims) from public.token_daily
                     where username = p_uname), 0)::numeric
          * coalesce((select tower_rate from public.pack_def where id = p_pack), 0))::integer
    + case when p_pack = 'r100k'
           then coalesce((select sum(packs) from public.leaderboard_claims
                           where username = p_uname), 0)::integer
           else 0 end, 0));
$$;

create or replace function public._packs_of(p_uname text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(d.id, coalesce(pp.qty, 0)::integer), '{}'::jsonb)
    from public.pack_def d
    left join public.player_packs pp
      on pp.pack = d.id and pp.username = p_uname;
$$;

-- Backfill sekali: pack yang sudah dimiliki sebelum migration dianggap sah
-- (tidak bisa dibedakan lagi mana beli jujur dan mana hasil F12 lama).
insert into public.player_packs (username, pack, qty)
select p.username, d.id,
       least(100000, greatest(0,
         case when coalesce(p.save_data->'rollPacks'->>d.id, '') ~ '^[0-9]{1,9}$'
              then (p.save_data->'rollPacks'->>d.id)::integer else 0 end))
  from public.player_saves p
  cross join public.pack_def d
on conflict (username, pack) do nothing;

-- Jatah historis dianggap sudah terpakai, jadi pack hasil backfill di atas
-- tidak bisa diklaim ulang; jatah baru bertambah dari klaim berikutnya.
insert into public.pack_allowance (username, pack, used)
select p.username, d.id, public._pack_allowance_for(p.username, d.id)
  from public.player_saves p
  cross join public.pack_def d
on conflict (username, pack) do nothing;


-- ============================================================
-- 4) PROGRES STORY / TOWER (bukti server untuk gating klaim)
-- ============================================================
create table if not exists public.story_progress (
  username   text        not null,
  diff       text        not null,
  max_lv     integer     not null default 0 check (max_lv >= 0),
  updated_at timestamptz not null default now(),
  primary key (username, diff)
);

create table if not exists public.tower_progress (
  username   text        not null primary key,
  max_floor  integer     not null default 0 check (max_floor >= 0),
  updated_at timestamptz not null default now()
);

alter table public.story_progress enable row level security;
alter table public.tower_progress enable row level security;
revoke all on public.story_progress from anon, authenticated;
revoke all on public.tower_progress from anon, authenticated;

-- Backfill amnesty: progres yang SUDAH ada sebelum 0029 diterima apa adanya.
insert into public.story_progress (username, diff, max_lv)
select p.username, d.diff,
       coalesce(max(case when kv.key ~ '^[0-9]{1,4}$' then kv.key::integer end), 0)
  from public.player_saves p
  cross join (select distinct diff from public.coin_story_stage) d
  left join lateral jsonb_each(
        case when jsonb_typeof(p.save_data->'clearedDiff'->d.diff) = 'object'
             then p.save_data->'clearedDiff'->d.diff else '{}'::jsonb end) kv on true
 group by p.username, d.diff
on conflict (username, diff) do update
  set max_lv = greatest(public.story_progress.max_lv, excluded.max_lv);

insert into public.story_progress (username, diff, max_lv)
select p.username, 'normal',
       coalesce(max(case when kv.key ~ '^[0-9]{1,4}$' then kv.key::integer end), 0)
  from public.player_saves p
  left join lateral jsonb_each(
        case when jsonb_typeof(p.save_data->'cleared') = 'object'
             then p.save_data->'cleared' else '{}'::jsonb end) kv on true
 group by p.username
on conflict (username, diff) do update
  set max_lv = greatest(public.story_progress.max_lv, excluded.max_lv);

insert into public.story_progress (username, diff, max_lv)
select username, diff, max(lv)
  from (
    select username,
           split_part(action_key, ':', 4) as diff,
           case when split_part(action_key, ':', 3) ~ '^[0-9]{1,4}$'
                then split_part(action_key, ':', 3)::integer end as lv
      from public.gem_claims
     where action_key like 'story:first:%'
    union all
    select username,
           split_part(action_key, ':', 4) as diff,
           case when split_part(action_key, ':', 3) ~ '^[0-9]{1,4}$'
                then split_part(action_key, ':', 3)::integer end as lv
      from public.coin_claims
     where action_key like 'coin:storyfirst:%'
  ) x
 where lv is not null and diff is not null and diff <> ''
 group by username, diff
on conflict (username, diff) do update
  set max_lv = greatest(public.story_progress.max_lv, excluded.max_lv);

insert into public.tower_progress (username, max_floor)
select p.username, greatest(0, public._int_of(p.save_data->'tower', 'best', 0))
  from public.player_saves p
on conflict (username) do nothing;


create or replace function public._rebuild_packs(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim  jsonb := case when jsonb_typeof(p_merged->'rollPacks') = 'object'
                         then p_merged->'rollPacks' else '{}'::jsonb end;
  v_out    jsonb := '{}'::jsonb;
  v_allow  integer;
  v_used   integer;
  v_pack   text;
  v_claim_qty integer;
  v_led    integer;
  v_grant  integer;
  v_excess integer;
begin
  for v_pack in select id from public.pack_def order by gems desc loop
    v_claim_qty := case when coalesce(v_claim->>v_pack, '') ~ '^[0-9]{1,9}$'
                        then (v_claim->>v_pack)::integer else 0 end;
    select coalesce(qty, 0) into v_led
      from public.player_packs where username = p_uname and pack = v_pack;
    v_led := coalesce(v_led, 0);

    select coalesce(used, 0) into v_used
      from public.pack_allowance where username = p_uname and pack = v_pack;
    v_used  := coalesce(v_used, 0);
    v_allow := greatest(0, public._pack_allowance_for(p_uname, v_pack) - v_used);

    v_grant := 0;
    if v_claim_qty < v_led then
      -- Konsumsi pack (roll) terjadi di client dan SELALU diterima: nilainya
      -- hanya turun, tidak ada keuntungan dari memalsukan angka lebih kecil.
      update public.player_packs set qty = v_claim_qty
       where username = p_uname and pack = v_pack;
      v_led := v_claim_qty;
    elsif v_claim_qty > v_led then
      v_grant := least(v_claim_qty - v_led, v_allow);
      if v_grant > 0 then
        insert into public.player_packs (username, pack, qty)
        values (p_uname, v_pack, v_led + v_grant)
        on conflict (username, pack) do update set qty = excluded.qty;
        v_used := v_used + v_grant;
        insert into public.pack_allowance (username, pack, used)
        values (p_uname, v_pack, v_used)
        on conflict (username, pack) do update set used = excluded.used;
      end if;
      v_excess := v_claim_qty - v_led - v_grant;
      if v_excess > 0 then
        perform public._tamper(p_uname, 'PACK_INFLATE', 'rollPacks.' || v_pack,
                               v_claim_qty::text, (v_led + v_grant)::text,
                               jsonb_build_object('pack', v_pack, 'zeroed', v_excess));
      end if;
    end if;

    v_out := jsonb_set(v_out, array[v_pack], to_jsonb(v_led + v_grant), true);
  end loop;

  return jsonb_set(p_merged, '{rollPacks}', v_out, true);
end;
$$;

create or replace function public._check_weather(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w    jsonb := p_merged->'weather';
  v_id   text;
  v_end  numeric;
  v_best text;
  v_now  numeric := extract(epoch from now()) * 1000;
begin
  if v_w is null or jsonb_typeof(v_w) = 'null' then
    return jsonb_set(p_merged, '{weather}', 'null'::jsonb, true);
  end if;

  if jsonb_typeof(v_w) <> 'object' then
    perform public._tamper(p_uname, 'WEATHER_TAMPER', 'weather', left(v_w::text, 120), 'null');
    return jsonb_set(p_merged, '{weather}', 'null'::jsonb, true);
  end if;

  v_id  := v_w->>'id';
  v_end := public._num_of(v_w, 'endsAt', 0);

  if v_id is null or not exists (select 1 from public.weather_def where id = v_id) then
    perform public._tamper(p_uname, 'WEATHER_TAMPER', 'weather.id', v_id, 'known id');
    p_merged := jsonb_set(p_merged, '{weather}', 'null'::jsonb, true);
  elsif v_end > v_now + 1860000 then
    -- maksimum sah 30 menit (beli premium / rotasi alami) + 1 menit skew
    perform public._tamper(p_uname, 'WEATHER_TAMPER', 'weather.endsAt',
                           v_end::text, '1860000');
    p_merged := jsonb_set(p_merged, '{weather}', 'null'::jsonb, true);
  end if;

  v_best := p_merged->>'weatherBest';
  if v_best is not null
     and not exists (select 1 from public.weather_def where id = v_best) then
    perform public._tamper(p_uname, 'WEATHER_TAMPER', 'weatherBest', v_best, 'known id');
    p_merged := jsonb_set(p_merged, '{weatherBest}', 'null'::jsonb, true);
  end if;

  return p_merged;
end;
$$;

create or replace function public._check_pots(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims bigint;
  v_ceil   integer;
  v_key    text;
  v_val    integer;
  v_arr    jsonb;
  v_out    jsonb;
  v_i      integer;
  v_n      integer;
begin
  -- Stok potion hanya bisa datang dari drop tower (drop rate <=10%/lantai) dan
  -- toko token. Plafon = 200 + 2 x total klaim lantai (8x peluang asli).
  select coalesce(sum(claims), 0) into v_claims
    from public.token_daily where username = p_uname;
  v_ceil := 200 + 2 * coalesce(v_claims, 0);

  foreach v_key in array array['potions', 'mythicPotions'] loop
    v_val := public._int_of(p_merged, v_key, 0);
    if v_val > v_ceil then
      perform public._tamper(p_uname, 'POT_INFLATE', v_key, v_val::text, v_ceil::text);
      p_merged := jsonb_set(p_merged, array[v_key], '0'::jsonb, true);
    elsif v_val < 0 then
      p_merged := jsonb_set(p_merged, array[v_key], '0'::jsonb, true);
    end if;
  end loop;

  foreach v_key in array array['luckPots', 'speedPots'] loop
    v_arr := case when jsonb_typeof(p_merged->v_key) = 'array'
                  then p_merged->v_key else '[]'::jsonb end;
    v_out := '[]'::jsonb;
    v_n   := jsonb_array_length(v_arr);
    for v_i in 0..2 loop
      v_val := 0;
      if v_i < v_n then
        v_val := case when coalesce(v_arr->>v_i, '') ~ '^[0-9]{1,9}$'
                      then (v_arr->>v_i)::integer else 0 end;
      end if;
      if v_val > v_ceil then
        perform public._tamper(p_uname, 'POT_INFLATE', v_key || '[' || v_i || ']',
                               v_val::text, v_ceil::text);
        v_val := 0;
      end if;
      v_out := v_out || to_jsonb(greatest(0, v_val));
    end loop;
    p_merged := jsonb_set(p_merged, array[v_key], v_out, true);
  end loop;

  return p_merged;
end;
$$;

create or replace function public._check_progress(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_lv integer;
  v_diff   text;
  v_front  integer;
  v_cd     jsonb;
  v_new    jsonb;
  v_lv     integer;
  v_before integer;
  v_after  integer;
  v_removed integer := 0;
  v_cleared jsonb;
begin
  select coalesce(max(lv), 30) into v_max_lv from public.coin_story_stage;

  v_cd := case when jsonb_typeof(p_merged->'clearedDiff') = 'object'
               then p_merged->'clearedDiff' else '{}'::jsonb end;

  for v_diff in select distinct diff from public.coin_story_stage loop
    select coalesce(max_lv, 0) into v_front
      from public.story_progress where username = p_uname and diff = v_diff;
    v_front := coalesce(v_front, 0) + 1;   -- toleransi satu stage di depan

    v_new := '{}'::jsonb;
    v_before := 0;
    if jsonb_typeof(v_cd->v_diff) = 'object' then
      select count(*) into v_before from jsonb_each(v_cd->v_diff) kv
       where kv.key ~ '^[0-9]{1,4}$';
      for v_lv in
        select (kv.key)::integer from jsonb_each(v_cd->v_diff) kv
         where kv.key ~ '^[0-9]{1,4}$'
      loop
        if v_lv >= 1 and v_lv <= v_max_lv and v_lv <= v_front then
          v_new := v_new || jsonb_build_object(v_lv::text, true);
        end if;
      end loop;
    end if;
    select count(*) into v_after from jsonb_each(v_new);
    v_removed := v_removed + greatest(0, v_before - v_after);
    v_cd := jsonb_set(v_cd, array[v_diff], v_new, true);
  end loop;

  -- diff asing (mis. "god") dibuang
  for v_diff in select key from jsonb_each(v_cd) loop
    if not exists (select 1 from public.coin_story_stage where diff = v_diff) then
      v_cd := v_cd - v_diff;
      v_removed := v_removed + 1;
    end if;
  end loop;

  -- legacy `cleared` = progres normal
  v_cleared := case when jsonb_typeof(p_merged->'cleared') = 'object'
                    then p_merged->'cleared' else '{}'::jsonb end;
  select coalesce(max_lv, 0) into v_front
    from public.story_progress where username = p_uname and diff = 'normal';
  v_front := coalesce(v_front, 0) + 1;

  v_new := '{}'::jsonb;
  select count(*) into v_before from jsonb_each(v_cleared) kv
   where kv.key ~ '^[0-9]{1,4}$';
  for v_lv in
    select (kv.key)::integer from jsonb_each(v_cleared) kv
     where kv.key ~ '^[0-9]{1,4}$'
  loop
    if v_lv >= 1 and v_lv <= v_max_lv and v_lv <= v_front then
      v_new := v_new || jsonb_build_object(v_lv::text, true);
    end if;
  end loop;
  select count(*) into v_after from jsonb_each(v_new);
  v_removed := v_removed + greatest(0, v_before - v_after);

  if v_removed > 0 then
    perform public._tamper(p_uname, 'PROGRESS_FAKE', 'cleared', v_removed::text, '0',
                           jsonb_build_object('removed', v_removed));
  end if;

  return jsonb_set(jsonb_set(p_merged, '{clearedDiff}', v_cd, true),
                   '{cleared}', v_new, true);
end;
$$;

create or replace function public._check_profile(
  p_merged jsonb,
  p_uname  text,
  p_old    jsonb,
  p_upd    timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ps     numeric;
  v_allow  numeric;
  v_old_ps numeric;
  v_av     text;
  v_pub    jsonb;
  v_titles jsonb;
  v_bad    boolean := false;
  v_out    jsonb;
begin
  -- playSec: hanya boleh naik sebesar waktu nyata sejak push terakhir.
  v_old_ps := public._num_of(p_old, 'playSec', 0);
  v_ps     := public._num_of(p_merged, 'playSec', 0);
  v_allow  := greatest(0, extract(epoch from (now() - coalesce(p_upd, now()))) + 300);
  if v_ps > v_old_ps + v_allow then
    perform public._tamper(p_uname, 'PLAY_INFLATE', 'playSec',
                           round(v_ps)::text, round(v_old_ps + v_allow)::text);
    p_merged := jsonb_set(p_merged, '{playSec}', to_jsonb(v_old_ps), true);
  elsif v_ps < 0 then
    p_merged := jsonb_set(p_merged, '{playSec}', '0'::jsonb, true);
  end if;

  -- customAvatar: hanya data URL gambar <= 24000 char.
  v_av := p_merged->>'customAvatar';
  if v_av is not null and (v_av not like 'data:image/%' or length(v_av) > 24000) then
    perform public._tamper(p_uname, 'PUB_TAMPER', 'customAvatar',
                           left(v_av, 60), 'data:image/*');
    p_merged := p_merged - 'customAvatar';
  end if;

  -- pub: ringkasan profil publik. Angka mustahil / char tak dikenal -> dibuang.
  v_pub := p_merged->'pub';
  if v_pub is not null then
    if jsonb_typeof(v_pub) <> 'object' then
      v_bad := true;
    else
      v_bad := public._num_of(v_pub, 'power', 0) > 1e12
            or public._num_of(v_pub, 'rolls', 0) > 1e12
            or public._num_of(v_pub, 'xp', 0) > 1e15
            or coalesce(v_pub->>'power', '') ~ '^[0-9]{16,}$'
            or coalesce(v_pub->>'rolls', '') ~ '^[0-9]{16,}$'
            or coalesce(v_pub->>'xp', '') ~ '^[0-9]{19,}$'
            or length(coalesce(v_pub->>'title', '')) > 40
            or length(coalesce(v_pub->'rare'->>'n', '')) > 60
            or length(coalesce(v_pub->'hero'->>'c', '')) > 60
            or (v_pub ? 'hero'
                and not exists (select 1 from public.card_stat
                                 where char_id = v_pub->'hero'->>'c'));
    end if;
    if v_bad then
      perform public._tamper(p_uname, 'PUB_TAMPER', 'pub', left(v_pub::text, 120), 'object');
      p_merged := p_merged - 'pub';
    end if;
  end if;

  -- titles: array string pendek, maks 100.
  v_titles := p_merged->'titles';
  if v_titles is not null then
    if jsonb_typeof(v_titles) <> 'array' then
      p_merged := jsonb_set(p_merged, '{titles}', '[]'::jsonb, true);
      perform public._tamper(p_uname, 'PUB_TAMPER', 'titles', left(v_titles::text, 60), 'array');
    else
      select coalesce(jsonb_agg(t.v), '[]'::jsonb) into v_out
        from (
          select e.v
            from jsonb_array_elements(v_titles) with ordinality as e(v, ord)
           where ord <= 100
             and jsonb_typeof(e.v) = 'string'
             and length(e.v #>> '{}') between 1 and 40
        ) t;
      if v_out is distinct from v_titles then
        perform public._tamper(p_uname, 'PUB_TAMPER', 'titles',
                               jsonb_array_length(v_titles)::text,
                               jsonb_array_length(v_out)::text);
        p_merged := jsonb_set(p_merged, '{titles}', v_out, true);
      end if;
    end if;
  end if;

  return p_merged;
end;
$$;

-- ============================================================
-- 6) GATING KLAIM: hadiah hanya untuk progres yang berurutan
-- ============================================================
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
  c_per_chapter constant integer := 6;
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gems   integer;
  v_key    text;
  v_ins    integer;
  v_today  integer;
  v_bal    integer;
  v_front  integer;
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

  -- 0029: stage/bab harus sudah terjangkau menurut progres server.
  select coalesce(max_lv, 0) into v_front
    from public.story_progress where username = v_uname and diff = p_diff;
  v_front := coalesce(v_front, 0);
  if p_kind = 'stage' then
    if p_no > v_front + 1 then
      perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_story_gem',
                             p_no::text, (v_front + 1)::text,
                             jsonb_build_object('diff', p_diff, 'kind', p_kind));
      return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE', 'max', v_front);
    end if;
  else
    -- toleransi 1 stage: klaim stage terakhir & bonus bab dikirim bersamaan
    -- (dua request async), jadi frontier bisa tertinggal satu langkah.
    if v_front < p_no * c_per_chapter - 1 then
      perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_story_gem',
                             p_no::text, (p_no * c_per_chapter - 1)::text,
                             jsonb_build_object('diff', p_diff, 'kind', p_kind));
      return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                                'need', p_no * c_per_chapter - 1);
    end if;
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

  if p_kind = 'stage' then
    insert into public.story_progress (username, diff, max_lv)
    values (v_uname, p_diff, p_no)
    on conflict (username, diff) do update
      set max_lv = greatest(public.story_progress.max_lv, excluded.max_lv),
          updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal);
end;
$$;

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
  v_front  integer;
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

  -- 0029: replay hanya untuk stage yang sudah pernah ditembus.
  select coalesce(max_lv, 0) into v_front
    from public.story_progress where username = v_uname and diff = p_diff;
  if p_lv > coalesce(v_front, 0) then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_story_replay',
                           p_lv::text, coalesce(v_front,0)::text,
                           jsonb_build_object('diff', p_diff));
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE', 'max', coalesce(v_front,0));
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
  v_front  integer;
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

  -- 0029: stage harus terjangkau (frontier + 1).
  select coalesce(max_lv, 0) into v_front
    from public.story_progress where username = v_uname and diff = p_diff;
  if p_lv > coalesce(v_front, 0) + 1 then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_story_coins',
                           p_lv::text, (coalesce(v_front,0) + 1)::text,
                           jsonb_build_object('diff', p_diff));
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                              'max', coalesce(v_front,0));
  end if;

  select last_at into v_last
    from public.coin_claims
   where username = v_uname and action_key = 'coin:storyfirst:' || p_lv || ':' || p_diff;

  if v_last is not null then
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

  if v_kind = 'first' then
    insert into public.story_progress (username, diff, max_lv)
    values (v_uname, p_diff, p_lv)
    on conflict (username, diff) do update
      set max_lv = greatest(public.story_progress.max_lv, excluded.max_lv),
          updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'coins', v_amt, 'kind', v_kind,
                            'coins_balance', v_bal);
end;
$$;

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
  v_front  integer;
  v_limit  integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  -- 0029: lantai harus dalam jendela yang bisa dibuka UI.
  -- tower-lobby.js: maxFloor = max(15, ceil((best+5)/5)*5) -> best+5, minimal 15.
  select coalesce(max_floor, 0) into v_front
    from public.tower_progress where username = v_uname;
  v_limit := greatest(coalesce(v_front, 0) + 5, 15);
  if p_floor > v_limit then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_tower_coins',
                           p_floor::text, v_limit::text);
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                              'max', v_limit);
  end if;

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

  insert into public.tower_progress (username, max_floor)
  values (v_uname, p_floor)
  on conflict (username) do update
    set max_floor = greatest(public.tower_progress.max_floor, excluded.max_floor),
        updated_at = now();

  return jsonb_build_object('ok', true, 'coins', v_amt, 'coins_balance', v_bal);
end;
$$;

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
  v_front  integer;
  v_limit  integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  -- 0029: jendela lantai yang sama seperti claim_tower_coins (best+5, min 15).
  select coalesce(max_floor, 0) into v_front
    from public.tower_progress where username = v_uname;
  v_limit := greatest(coalesce(v_front, 0) + 5, 15);
  if p_floor > v_limit then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_tower_tokens',
                           p_floor::text, v_limit::text);
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                              'max', v_limit);
  end if;

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

  insert into public.tower_progress (username, max_floor)
  values (v_uname, p_floor)
  on conflict (username) do update
    set max_floor = greatest(public.tower_progress.max_floor, excluded.max_floor),
        updated_at = now();

  return jsonb_build_object('ok', true, 'gained', v_gain,
                            'tokens', v_bal, 'infTokens', v_bal);
end;
$$;

-- ============================================================
-- 7) RPC: beli pack instan (harga dari pack_def)
-- ============================================================
create or replace function public.buy_pack(p_pack text, p_qty integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_gems  integer;
  v_price integer;
  v_qty   integer;
  v_cost  integer;
  v_bal   integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select gems into v_price from public.pack_def where id = p_pack;
  if v_price is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_PACK');
  end if;

  v_qty := greatest(1, least(coalesce(p_qty, 1), 25));
  v_cost := v_price * v_qty;

  select username, public._int_of(save_data, 'premiumGems', 0)
    into v_uname, v_gems
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if v_gems < v_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', v_gems, 'cost', v_cost);
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
           to_jsonb(v_gems - v_cost), true),
         updated_at = now()
   where user_id = v_uid;

  insert into public.player_packs (username, pack, qty)
  values (v_uname, p_pack, v_qty)
  on conflict (username, pack) do update
    set qty = public.player_packs.qty + excluded.qty;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{rollPacks}',
           public._packs_of(v_uname), true)
   where user_id = v_uid;

  select public._int_of(save_data, 'premiumGems', 0) into v_bal
    from public.player_saves where user_id = v_uid;

  return jsonb_build_object('ok', true, 'pack', p_pack,
                            'qty', (select qty from public.player_packs
                                     where username = v_uname and pack = p_pack),
                            'rollPacks', public._packs_of(v_uname),
                            'balance', coalesce(v_bal, v_gems - v_cost));
end;
$$;

-- ============================================================
-- 8) spend_gems: jalur beli pack client lama (harga persis)
-- ============================================================
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
  v_delta_cost integer := 0;
  v_rec   record;
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
  -- ledger. Tanpa catatan, merge akan membuangnya.
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

  -- 0029: client lama membeli pack lewat spend_gems. Pack dicatat HANYA kalau
  -- total harga delta pack == p_cost persis, jadi pembelian artefak/pet tidak
  -- bisa dipakai membayar pack (dan sebaliknya).
  for v_rec in
    select d.id, d.gems,
           greatest(0,
             case when coalesce(p_save_data->'rollPacks'->>d.id, '') ~ '^[0-9]{1,9}$'
                  then (p_save_data->'rollPacks'->>d.id)::integer else 0 end
             - coalesce(pp.qty, 0)) as dq
      from public.pack_def d
      left join public.player_packs pp
        on pp.username = v_uname and pp.pack = d.id
  loop
    if v_rec.dq > 0 then
      v_delta_cost := v_delta_cost + v_rec.dq * v_rec.gems;
    end if;
  end loop;

  if v_delta_cost > 0 and v_delta_cost = p_cost then
    for v_rec in
      select d.id,
             greatest(0,
               case when coalesce(p_save_data->'rollPacks'->>d.id, '') ~ '^[0-9]{1,9}$'
                    then (p_save_data->'rollPacks'->>d.id)::integer else 0 end
               - coalesce(pp.qty, 0)) as dq
        from public.pack_def d
        left join public.player_packs pp
          on pp.username = v_uname and pp.pack = d.id
    loop
      if v_rec.dq > 0 then
        insert into public.player_packs (username, pack, qty)
        values (v_uname, v_rec.id, v_rec.dq)
        on conflict (username, pack) do update
          set qty = public.player_packs.qty + excluded.qty;
      end if;
    end loop;
  end if;

  v_res := public.merge_player_state(coalesce(p_save_data, '{}'::jsonb), false, false);

  if v_res is null or coalesce((v_res->>'ok')::boolean, false) is not true then
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
             to_jsonb(public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) + p_cost), true),
           updated_at = now()
     where user_id = v_uid;
    return coalesce(v_res, jsonb_build_object('ok', false, 'msg', 'MERGE_FAIL'));
  end if;

  return jsonb_build_object('ok', true,
    'balance', coalesce((v_res->>'premiumGems')::integer, v_gems - p_cost),
    'cost', p_cost,
    'rollPacks', coalesce(v_res->'rollPacks', '{}'::jsonb));
end;
$$;

-- ============================================================
-- 9) MERGE: semua field client-trust dipolisikan
-- ============================================================
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
  c_xp_push   constant bigint  := 200000;    -- 0029: maks delta XP per push
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
  v_updated timestamptz;
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
         save_data,
         updated_at
    into uname, cur_gems, cur_coins, cur_wb, cur_inf, cur_lv, cur_xp, cur_legacy, old_save, v_updated
    from public.player_saves where user_id = v_uid limit 1
    for update;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  new_gems := coalesce(nullif(p_save_data->>'premiumGems','')::integer, 0);

  -- 0029: klaim gem di atas saldo server = edit F12 (server tetap menang).
  if new_gems > cur_gems then
    perform public._tamper(uname, 'GEM_INFLATE', 'premiumGems',
                           new_gems::text, cur_gems::text);
  end if;

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

  -- 0028 PENALTI COIN: angka `coins` absolut dari client selalu dibuang, tapi
  -- klaim jauh di atas saldo server = edit F12 -> saldo 0 + catat.
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

  -- 0029: satu push tidak boleh membawa XP lebih dari c_xp_push.
  if xp_gain > c_xp_push then
    perform public._tamper(uname, 'XP_DELTA', '_xpGain', xp_gain::text, c_xp_push::text);
    xp_gain := c_xp_push;
  end if;

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
  -- dan flag _rebirthDo; client lama memakai jalur legacy yang tetap dibatasi.
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

  -- 0029: klaim token/level/xp di atas nilai server = edit F12.
  if public._token_of(merged, 'wbTokens') > cur_wb then
    perform public._tamper(uname, 'TOKEN_INFLATE', 'wbTokens',
                           public._token_of(merged, 'wbTokens')::text, cur_wb::text);
  end if;
  if public._token_of(merged, 'infTokens') > cur_inf then
    perform public._tamper(uname, 'TOKEN_INFLATE', 'infTokens',
                           public._token_of(merged, 'infTokens')::text, cur_inf::text);
  end if;
  if public._int_of(merged, 'playerLv', 1) > new_lv then
    perform public._tamper(uname, 'LEVEL_INFLATE', 'playerLv',
                           public._int_of(merged, 'playerLv', 1)::text, new_lv::text);
  end if;
  if public._int_of(merged, 'xp', 0) > new_xp then
    perform public._tamper(uname, 'XP_INFLATE', 'xp',
                           public._int_of(merged, 'xp', 0)::text, new_xp::text);
  end if;

  -- Token + level/xp: nilai server yang menang.
  merged := jsonb_set(merged, '{wbTokens}',  to_jsonb(cur_wb),  true);
  merged := jsonb_set(merged, '{infTokens}', to_jsonb(cur_inf), true);
  merged := jsonb_set(merged, '{playerLv}',  to_jsonb(new_lv),  true);
  merged := jsonb_set(merged, '{xp}',        to_jsonb(new_xp),  true);

  -- INVENTORI: bersihkan entri mustahil / dobel, lalu polisikan atribut.
  if p_skip_stacks or not (merged ? 'stacks') then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  else
    merged := jsonb_set(merged, '{stacks}',
      public._clean_stacks(merged->'stacks'), true);
  end if;
  if not p_skip_stacks then
    merged := jsonb_set(merged, '{deck}',
      public._clean_deck(merged->'deck', merged->'stacks'), true);
    merged := jsonb_set(merged, '{equippedId}',
      public._clean_equip(merged->>'equippedId', merged->'stacks'), true);
    merged := jsonb_set(merged, '{equippedId2}',
      public._clean_equip(merged->>'equippedId2', merged->'stacks'), true);
  end if;

  -- 0029: pack instan dari ledger + jatah server; kelebihan -> 0.
  merged := public._rebuild_packs(merged, uname);
  -- 0029: weather/weatherBest, stok potion, progres cerita, profil publik.
  merged := public._check_weather(merged, uname);
  merged := public._check_pots(merged, uname);
  merged := public._check_progress(merged, uname);
  merged := public._check_profile(merged, uname, old_save, v_updated);

  -- PET / ARTEFAK (0028): kepemilikan dibangun dari ledger server.
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

  -- LUCK + SKILL TREE: dikunci ke server; tree divalidasi anggaran SP.
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
    'artSlots', coalesce(merged->'artSlots', '[null,null]'::jsonb),
    -- 0029: nilai server untuk field yang dipolisikan + daftar pelanggaran
    'rollPacks', coalesce(merged->'rollPacks', '{}'::jsonb),
    'weather',   coalesce(merged->'weather', 'null'::jsonb),
    'potions',   coalesce(merged->'potions', '0'::jsonb),
    'mythicPotions', coalesce(merged->'mythicPotions', '0'::jsonb),
    'luckPots',  coalesce(merged->'luckPots', '[0,0,0]'::jsonb),
    'speedPots', coalesce(merged->'speedPots', '[0,0,0]'::jsonb),
    'tamper', coalesce((
       select jsonb_agg(jsonb_build_object('reason', reason, 'field', field))
         from public.tamper_log
        where username = uname and at >= now()), '[]'::jsonb));
end;
$$;

-- ============================================================
-- 10) LEADERBOARD: plafon papan realistis, nilai di atasnya DITOLAK
-- ============================================================
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
  per       text := public.lb_period(false);
  req       numeric;
  meta      jsonb := coalesce(p_meta, '{}'::jsonb);

  -- ---- PLAFON / ATURAN LAJU per papan (EDIT ANGKA DI SINI) ----
  c_abs       numeric;
  c_step_mul  numeric;
  c_step_add  numeric;
  c_first     numeric;
  c_daily_max integer := 500;

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

  -- 0029: plafon realistis. Nilai di atasnya = F12, submit DITOLAK (tidak
  -- disimpan sama sekali) dan dicatat.
  if brd = 'inf_tower' then
    c_abs := 9999;       c_step_mul := 1;    c_step_add := 200; c_first := 50;
  elsif brd = 'deck_power' then
    c_abs := 200000000;  c_step_mul := 10;   c_step_add := 0;   c_first := 100000;
  else -- rarest_pull
    c_abs := 100000000000; c_step_mul := 1000; c_step_add := 0; c_first := 100000000;
  end if;

  if req > c_abs then
    perform public._tamper(uname, 'LB_INFLATE', brd, req::text, c_abs::text);
    return jsonb_build_object('ok', false, 'msg', 'LB_INFLATE', 'max', c_abs);
  end if;

  select value, inc_day, inc_count into old_val, old_day, old_cnt
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  if old_val is not null and old_val >= req then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank);
  end if;

  eff := least(req, c_abs);
  if old_val is null then
    eff := least(eff, c_first);
  else
    eff := least(eff, old_val * c_step_mul + c_step_add);
  end if;

  if old_day is distinct from day_key then
    old_cnt := 0;
  end if;

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

  return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                            'value', row_value, 'rank', my_rank);
end;
$$;

-- ============================================================
-- 11) GRANT: RPC tulis JWT-only, helper tidak bisa dipanggil client
-- ============================================================
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merge_player_state(jsonb, boolean, boolean)',
    'public.spend_gems(integer, boolean, jsonb)',
    'public.buy_pack(text, integer)',
    'public.claim_story_gem(integer, text, text)',
    'public.claim_story_replay(integer, text)',
    'public.claim_story_coins(integer, text)',
    'public.claim_tower_coins(integer)',
    'public.claim_tower_tokens(integer)',
    'public.submit_leaderboard_score(text, numeric, jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array array[
    'public._tamper(text, text, text, text, text, jsonb)',
    'public._pack_allowance_for(text, text)',
    'public._packs_of(text)',
    'public._rebuild_packs(jsonb, text)',
    'public._check_weather(jsonb, text)',
    'public._check_pots(jsonb, text)',
    'public._check_progress(jsonb, text)',
    'public._check_profile(jsonb, text, jsonb, timestamptz)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
