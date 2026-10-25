-- 0027_progress_guard.sql — Unit 3c: guard progres save + cap damage World Boss
--
-- Celah sebelum ini (hasil audit 2026-10-25): setelah 0025/0026 mengunci saldo,
-- masih ada key save yang diterima apa adanya dari client. F12 cukup menulis
--   state.player.luckFlat = 99999
--   state.player.tree = {semua node:true}
--   state.rebirth.essence = 1e9
--   state.stacks.push({char:"CH_...",mut:"ultima",shiny:true,trait:"bigbang"})
-- lalu save(); semuanya tersimpan permanen. World Boss bahkan lebih parah:
-- submit_world_boss_run menerima p_dmg mentah (hanya di-clamp ke ukuran pool),
-- jadi satu run bisa menghapus 1T HP boss.
--
-- Yang dikerjakan file ini:
--   1. TABEL CERMIN dari client (card_stat, tree_node, pet_def, art_def) supaya
--      server bisa memeriksa isi save tanpa menebak. Sumbernya js/data.js
--      (STORY_BIBLE/PET_DEFS/ART_DEFS) dan js/panels.js (TREE_NODES) —
--      regenerate dengan _tmp/gen_0027.cjs kalau file itu berubah.
--   2. merge_player_state: nilai absolut rebirth dibuang (delta _rebirthGain +
--      flag _rebirthDo, pola sama seperti _coinSpend/_xpGain), luck player
--      dikunci ke nilai server, pohon skill divalidasi terhadap SP yang memang
--      dimiliki (level server - 1), dan inventori dibersihkan: char harus ada di
--      card_stat, tier ditimpa dari tabel, mut/trait di-whitelist, varian dobel
--      dibuang (cermin dedupStacksInPlace), deck/equipped/pet/artefak harus
--      menunjuk id yang benar-benar ada di save.
--   3. register_player: akun baru tidak bisa mendaftar membawa progres palsu.
--   4. submit_world_boss_run: damage dibatasi plafon yang dihitung server dari
--      kartu terkuat yang BENAR-BENAR ada di save (base_atk x mutasi x shiny x
--      trait x RAID_DMG_SCALE x RAID_TURNS x 80). Satu run tidak bisa lagi
--      menghapus seluruh pool dengan satu angka.
--
-- Batas jujur (dokumentasi, bukan bug):
--   * Roll & battle tetap jalan di client. Kepemilikan kartu masih diakui dari
--     save (yang sekarang minimal strukturnya divalidasi), jadi penyerang yang
--     paham RPC masih bisa MENYUNTIK satu varian terkuat. Efeknya dibatasi:
--     damage WB-nya tetap kena plafon kartu terkuat itu, dan saldo coin/gem/
--     token/level tetap milik server. Penutup penuh = roll dipindah ke server
--     (Unit 4), bukan sesuatu yang bisa ditambal di merge.
--   * cleared/clearedDiff belum dikunci: reward cerita dibayar server lewat
--     gem_claims/coin_claims sendiri, jadi mengubah cleared cuma membuka
--     pemilihan stage di UI (tidak menambah gem/coin).
--   * Plafon harian rebirth (5e7/hari) sengaja longgar: menahan injeksi satu
--     tembakan, bukan menakar farming legit.
--
-- URUTAN DEPLOY: aman dijalankan sebelum client baru. Client lama tidak mengirim
-- _rebirthGain/_rebirthDo, jadi merge memakai jalur legacy (essence absolut
-- diterima tapi dibatasi plafon harian + kenaikan count maksimal 1 per push).
-- Signature semua RPC TIDAK berubah, jadi build lama tidak 404.

-- ---------- 1) TABEL CERMIN CLIENT ----------
create table if not exists public.card_stat (
  char_id  text   primary key,
  tier     text   not null,
  base_atk integer not null check (base_atk >= 0),
  base_hp  integer not null check (base_hp >= 0)
);

insert into public.card_stat (char_id, tier, base_atk, base_hp) values
  ('CH_UNSTOPPABLE_FIST', 'R', 105, 211),
  ('CH_COPY_NINJA', 'R', 117, 234),
  ('CH_AWAKENED_DARK_AVENGER', 'R', 130, 260),
  ('CH_AWAKENED_PROMISED_CHILD', 'R', 146, 293),
  ('CH_SIX_PATHS_OF_PAIN', 'R', 165, 330),
  ('CH_BIJUU_BEAST', 'R', 181, 362),
  ('CH_ULTIMATE_WARRIOR', 'SR', 354, 707),
  ('CH_BODY_SWITCHER', 'SR', 423, 846),
  ('CH_NAMEKIAN_SAGE', 'SR', 489, 978),
  ('CH_AWAKENED_PRIDEFUL_PRINCE', 'SSR', 558, 1120),
  ('CH_AWAKENED_EARTHS_STRONGEST', 'SSR', 641, 1280),
  ('CH_AWAKENED_GALACTIC_TYRANT', 'SSR', 686, 1370),
  ('CH_CURSED_DOLL', 'SSR', 603, 1210),
  ('CH_SHADOW_SUMMONER', 'SSR', 783, 1570),
  ('CH_CURSED_FIST', 'SSR', 915, 1830),
  ('CH_RIKAS_BLESSING', 'SSR', 996, 1990),
  ('CH_LIMITLESS_MASTER', 'SSR', 1070, 2140),
  ('CH_KING_OF_CURSES', 'SSR', 1270, 2550),
  ('CH_PORCO_PILLAR', 'SSR', 1450, 2900),
  ('CH_AWAKENED_STAND_USER', 'SSR', 1650, 3300),
  ('CH_GOLD_EXPERIENCE Requiem', 'SSR', 1875, 3750),
  ('CH_THE WORLD', 'SSR', 2125, 4250),
  ('CH_OPALESTONE_DREAM', 'UR', 2400, 4800),
  ('CH_HEAVENS_DOOR', 'UR', 2750, 5500),
  ('CH_TANJIRO_BLADE', 'UR', 3100, 6200),
  ('CH_NEZUKO_BAMBOO', 'UR', 3500, 7000),
  ('CH Zenitsu_THUNDER', 'UR', 3950, 7900),
  ('CH_INUIZO_MASK', 'EX', 4450, 8900),
  ('CH_SANEMI_WIND', 'EX', 5000, 10000),
  ('CH_SHINOBU_BUTTERFLY', 'EX', 5750, 11500),
  ('CH_RULER', 'EX', 2394, 4787),
  ('CH_OTHERWORLDLY', 'EX', 2560, 5120),
  ('CH_DEVIL_HUNTER', 'UR', 2013, 4026),
  ('CH_NINE_TAIL', 'UR', 1782, 3563),
  ('CH_SHADOW_HEIR', 'UR', 1782, 3563),
  ('CH_FABLED_SOLDIER', 'UR', 1577, 3153),
  ('CH_IMMORTAL_COLOSSUS', 'UR', 1515, 3029),
  ('CH_TRICKSTER_ACE', 'UR', 1369, 2737),
  ('CH_UNDYING_ROGUE', 'UR', 1098, 2195),
  ('CH_SHADOW_MONARCH', 'EX', 971, 1942),
  ('CH_SHADOW_KING', 'EX', 13300, 25600),
  ('CH_ROYAL_VANGUARD', 'UR', 891, 1781),
  ('CH_REGRESSOR', 'UR', 764, 1527),
  ('CH_SIXFOLD_PROPHET', 'UR', 676, 1352),
  ('CH_THRILLER_KING', 'R', 896, 1792),
  ('CH_THREEBLADE_RONIN', 'UR', 620, 1240),
  ('CH_WILDHEART_HUNTER', 'SR', 130, 259),
  ('CH_SUNBREATH_SWORDSMAN', 'R', 69, 137),
  ('CH_YOUNG_SHADOW_HEIR', 'R', 56, 111),
  ('CH_YOUNG_SPIRIT_VESSEL', 'R', 44, 88),
  ('CH_DARKIN_LORD', 'SSR', 3520, 7040),
  ('CH_PSYCHIC_ESPER', 'SSR', 5340, 10600),
  ('CH_SUN_GOD', 'SSR', 4630, 9270),
  ('CH_ABSOLUTE_ZERO', 'SSR', 848, 1690),
  ('CH_ICE_QUEEN', 'SSR', 1070, 2140),
  ('CH_THE_STRUGGLER', 'SSR', 1260, 2510),
  ('CH_WHITE_HAWK', 'SSR', 1400, 2800),
  ('CH_HAVOC_WREACKER', 'SSR', 4210, 8430),
  ('CH_TIME_TRICKSTER', 'SSR', 3610, 7230),
  ('CH_YORDLE_INVENTOR', 'SSR', 3810, 7630),
  ('CH_DUMB_HAIR_GUY', 'SSR', 2770, 5540),
  ('CH_DUMB_STRETCHY_GUY', 'SSR', 2560, 5120),
  ('CH_GLITCHED_ENTITY', 'SSR', 2090, 4180),
  ('CH_THE_GRIEFER', 'SSR', 2580, 5160),
  ('CH_HEIGHT_OF_PAINTING', 'SSR', 1840, 3670),
  ('CH_INK_ANAMLOY', 'SSR', 1710, 3420),
  ('CH_BLIZZARD_BADDIE', 'SR', 175, 350),
  ('CH_PAPER_PAL', 'SR', 136, 272),
  ('CH_BLESSED_MAGE', 'SR', 190, 379),
  ('CH_THUNDER_PRODIGY', 'SR', 219, 438),
  ('CH_10TH_CAPTAIN', 'SR', 218, 435),
  ('CH_OCEANS_GUARDIAN', 'SR', 416, 831),
  ('CH_IMMORTAL_VAMPIRE', 'SR', 298, 595),
  ('CH_SEA_SOVEREIGN', 'SR', 470, 939),
  ('CH_PUPPETEER', 'SR', 284, 567),
  ('CH_SAND_VESSEL', 'SR', 316, 631),
  ('CH_BLESSED_SORCERER', 'SR', 548, 1090),
  ('CH_MOON_MOTHER', 'SR', 576, 1150),
  ('CH_ALMIGHTY_TYRANT', 'SSR', 608, 1210),
  ('CH_DEMON_SLIME', 'SSR', 933, 1860),
  ('CH_LUCK_VOLTIA', 'R', 85, 169),
  ('CH_NOBLE_COMPANION', 'R', 105, 210),
  ('CH_BLOODMOON_DEMON', 'R', 111, 222),
  ('CH_GREEN_BEAST', 'SR', 160, 320),
  ('CH_DRAGON_SIN', 'SR', 197, 394),
  ('CH_FROST_WIZARD', 'SR', 218, 436),
  ('CH_RUBBERBOUND_CAPTAIN', 'SR', 243, 485),
  ('CH_ICE_REAPER', 'SR', 243, 485),
  ('CH_FROSTBANE', 'SR', 267, 534),
  ('CH_COPYBLADE_MENTOR', 'SSR', 299, 598),
  ('CH_NULLBLADE_KNIGHT', 'SSR', 329, 658),
  ('CH_TITAN_HUNTER', 'SSR', 362, 723),
  ('CH_CRIMSON_WARLORD', 'SSR', 382, 763),
  ('CH_LIGHTBORNE_ADMIRAL', 'SSR', 346, 692),
  ('CH_SOUL_REAPER', 'SSR', 445, 890),
  ('CH_GALACTIC_TYRANT', 'SSR', 519, 1030),
  ('CH_SOLAR_BRAWLER', 'SSR', 549, 1090),
  ('CH_TREMOR_EMPEROR', 'UR', 2390, 4780),
  ('CH_ANT_KING', 'UR', 2560, 5120),
  ('CH_TIME_MASTER', 'UR', 3560, 7120),
  ('CH_OMNI_SOVEREIGN', 'UR', 4150, 8310),
  ('CH_ASTRAL_DEVOURER', 'UR', 5120, 10200),
  ('CH_BALD_KING', 'SSR', 843, 1680),
  ('CH_METEOR_CONQUEROR', 'SSR', 640, 1280),
  ('CH_ETERNAL_DRAGON', 'BOSS', 2600, 5200)
on conflict (char_id) do update
  set tier = excluded.tier, base_atk = excluded.base_atk, base_hp = excluded.base_hp;

-- cost & req = cermin TREE_NODES (panels.js). SP hanya didapat dari naik level
-- (+1/level), jadi anggaran server = playerLv - 1.
create table if not exists public.tree_node (
  id   text    primary key,
  cost integer not null check (cost >= 0),
  req  text[]  not null default '{}'
);

insert into public.tree_node (id, cost, req) values
  ('root', 0, array[]::text[]),
  ('lk1', 1, array['root']::text[]),
  ('lk2', 3, array['lk1']::text[]),
  ('lk3', 5, array['lk2']::text[]),
  ('lk4', 10, array['lk3']::text[]),
  ('lk5', 15, array['lk4']::text[]),
  ('sp1', 1, array['root']::text[]),
  ('sp2', 3, array['sp1']::text[]),
  ('sp3', 5, array['sp2']::text[]),
  ('sp4', 10, array['sp3']::text[]),
  ('sp5', 15, array['sp4']::text[]),
  ('bst1', 10, array['lk5','sp5']::text[]),
  ('bst2', 10, array['bst1']::text[]),
  ('bst3', 10, array['bst2']::text[]),
  ('bst4', 10, array['bst3']::text[]),
  ('bst5', 20, array['bst4']::text[])
on conflict (id) do update set cost = excluded.cost, req = excluded.req;

create table if not exists public.pet_def (id text primary key);
create table if not exists public.art_def (id text primary key);

insert into public.pet_def (id) values
  ('doll'),
  ('otherworldly'),
  ('titan'),
  ('dragon'),
  ('nine-tail'),
  ('bijuu'),
  ('kyubi'),
  ('nebula-wisp'),
  ('next-bot'),
  ('cyber-kitsune')
on conflict (id) do nothing;

insert into public.art_def (id) values
  ('manik'),
  ('medal'),
  ('giok'),
  ('batu'),
  ('cincin'),
  ('intan'),
  ('pedang-api'),
  ('helm-abyss'),
  ('tameng-surgawi'),
  ('tome-infinity')
on conflict (id) do nothing;

-- Ledger essence rebirth (delta harian).
create table if not exists public.rebirth_daily (
  username text   not null,
  day      date   not null default ((now() at time zone 'utc')::date),
  gained   bigint not null default 0,
  primary key (username, day)
);

alter table public.card_stat     enable row level security;
alter table public.tree_node     enable row level security;
alter table public.pet_def       enable row level security;
alter table public.art_def       enable row level security;
alter table public.rebirth_daily enable row level security;
revoke all on public.card_stat     from anon, authenticated;
revoke all on public.tree_node     from anon, authenticated;
revoke all on public.pet_def       from anon, authenticated;
revoke all on public.art_def       from anon, authenticated;
revoke all on public.rebirth_daily from anon, authenticated;

-- ---------- 2) HELPER INTERNAL ----------
-- Angka jsonb yang aman: hasil edit save ("abc", "1e+21", negatif) jatuh ke default.
create or replace function public._num_of(p jsonb, k text, d numeric)
returns numeric
language sql
immutable
as $$
  select case
           when coalesce(p->>k,'') ~ '^[0-9]{1,15}(\.[0-9]{1,6})?$' then (p->>k)::numeric
           else d
         end;
$$;

-- Inventori: buang entri yang char-nya tidak dikenal, timpa tier dari card_stat,
-- whitelist mut/trait, paksa count=1, dan dedup per varian (char|mut|shiny)
-- dengan urutan yang sama seperti dedupStacksInPlace() di client (simpan yang
-- pertama muncul). Maksimum 20.000 entri supaya payload tidak jadi senjata.
create or replace function public._clean_stacks(p jsonb)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(s.v order by s.ord), '[]'::jsonb)
  from (
    select distinct on (
             e.v->>'char',
             coalesce(nullif(e.v->>'mut',''), 'none'),
             (e.v->>'shiny') in ('true','1')
           )
           e.ord,
           jsonb_build_object(
             'id',    case when coalesce(e.v->>'id','') ~ '^[A-Za-z0-9_-]{1,40}$'
                           then e.v->>'id'
                           else substr(md5((e.v->>'char') || '|' ||
                                coalesce(nullif(e.v->>'mut',''),'none') || '|' ||
                                case when (e.v->>'shiny') in ('true','1') then '1' else '0' end), 1, 9)
                      end,
             'char',  e.v->>'char',
             'tier',  cs.tier,
             'fav',   (e.v->>'fav') in ('true','1'),
             'lock',  (e.v->>'lock') in ('true','1'),
             'mut',   case when coalesce(nullif(e.v->>'mut',''),'none') in ('none','gold','rainbow','secret','ultima')
                           then coalesce(nullif(e.v->>'mut',''),'none') else 'none' end,
             'shiny', (e.v->>'shiny') in ('true','1'),
             'trait', case when coalesce(nullif(e.v->>'trait',''),'none') in
                             ('none','common','rare','legendary','superior','transiden','demigod','cosmic','bigbang')
                           then coalesce(nullif(e.v->>'trait',''),'none') else 'none' end,
             'count', 1
           ) as v
    from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
         with ordinality as e(v, ord)
    join public.card_stat cs on cs.char_id = (e.v->>'char')
    where e.ord <= 20000
      and jsonb_typeof(e.v) = 'object'
    order by e.v->>'char', coalesce(nullif(e.v->>'mut',''),'none'),
             (e.v->>'shiny') in ('true','1'), e.ord
  ) s;
$$;

-- Kepemilikan pet/artefak: hanya id yang dikenal, unik, maksimum 200.
create or replace function public._clean_owned(p jsonb, p_kind text)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(x.id order by x.ord), '[]'::jsonb)
  from (
    select distinct on (e.v #>> '{}') e.ord, e.v #>> '{}' as id
    from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
         with ordinality as e(v, ord)
    where e.ord <= 200
      and jsonb_typeof(e.v) = 'string'
      and exists (
        select 1 from public.pet_def d where p_kind = 'pet' and d.id = e.v #>> '{}'
        union all
        select 1 from public.art_def d where p_kind = 'art' and d.id = e.v #>> '{}'
      )
    order by e.v #>> '{}', e.ord
  ) x;
$$;

create or replace function public._clean_deck(p_deck jsonb, p_stacks jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  out_d jsonb := '[]'::jsonb;
  i     integer;
  v     text;
begin
  for i in 0..3 loop
    v := p_deck->>i;
    if v is not null and exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(p_stacks) = 'array' then p_stacks else '[]'::jsonb end) s
         where s->>'id' = v)
    then
      out_d := out_d || to_jsonb(v);
    else
      out_d := out_d || 'null'::jsonb;
    end if;
  end loop;
  return out_d;
end;
$$;

create or replace function public._clean_equip(p_id text, p_stacks jsonb)
returns jsonb
language sql
immutable
as $$
  select case when p_id is not null and exists (
           select 1 from jsonb_array_elements(
             case when jsonb_typeof(p_stacks) = 'array' then p_stacks else '[]'::jsonb end) s
           where s->>'id' = p_id)
         then to_jsonb(p_id) else 'null'::jsonb end;
$$;

-- Node pohon yang dianggap dimiliki (nilai truthy).
create or replace function public._tree_ids(p_tree jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(k), '{}')
  from jsonb_object_keys(case when jsonb_typeof(p_tree) = 'object' then p_tree else '{}'::jsonb end) k
  where lower(coalesce(p_tree->>k,'')) in ('true','1');
$$;

create or replace function public._tree_cost(p_tree jsonb)
returns integer
language sql
stable
as $$
  select coalesce(sum(t.cost), 0)::integer
  from public.tree_node t
  where t.id = any(public._tree_ids(p_tree));
$$;

-- Valid: semua id dikenal, prasyarat dimiliki, total biaya <= anggaran SP.
create or replace function public._tree_ok(p_tree jsonb, p_budget integer)
returns boolean
language plpgsql
stable
as $$
declare
  ids text[] := public._tree_ids(p_tree);
  bad text;
begin
  if jsonb_typeof(p_tree) is distinct from 'object' then return false; end if;
  if coalesce(array_length(ids, 1), 0) = 0 then return true; end if;

  select x into bad from unnest(ids) as x
   where not exists (select 1 from public.tree_node t where t.id = x)
   limit 1;
  if bad is not null then return false; end if;

  select t.id into bad from public.tree_node t
   where t.id = any(ids)
     and exists (select 1 from unnest(t.req) r where not (r = any(ids) or r = 'root'))
   limit 1;
  if bad is not null then return false; end if;

  return public._tree_cost(p_tree) <= greatest(0, p_budget);
end;
$$;

-- Plafon damage satu run World Boss, dihitung dari kartu terkuat yang ada di
-- save server (bukan angka client). 100 = RAID_DMG_SCALE, 10 = RAID_TURNS,
-- 80 = kelonggaran untuk crit/purple/ranton/everyNth/statGrow (batas atas yang
-- sangat longgar; tujuannya menghentikan "satu run habiskan pool", bukan
-- menakar skill). Kalau konstanta di cards-fx.js berubah, ubah di sini juga.
create or replace function public._wb_dmg_cap(p_save jsonb)
returns bigint
language sql
stable
as $$
  with scored as (
    select coalesce(max(
             cs.base_atk
             * case coalesce(nullif(s->>'mut',''),'none')
                 when 'gold' then 10 when 'rainbow' then 25
                 when 'secret' then 50 when 'ultima' then 100 else 1 end
             * case when (s->>'shiny') in ('true','1') then 5 else 1 end
             * case coalesce(nullif(s->>'trait',''),'none')
                 when 'common' then 1.10 when 'rare' then 1.10
                 when 'legendary' then 1.25 when 'superior' then 1.50
                 when 'transiden' then 2.00 when 'demigod' then 3.00
                 when 'cosmic' then 3.50 when 'bigbang' then 5.00 else 1 end
           ), 0) as atk
    from jsonb_array_elements(
           case when jsonb_typeof(p_save->'stacks') = 'array' then p_save->'stacks' else '[]'::jsonb end) s
    join public.card_stat cs on cs.char_id = s->>'char'
  )
  select greatest(10000000::bigint, ceil(coalesce(atk, 0) * 100 * 10 * 80)::bigint)
  from scored;
$$;

-- SP warisan: sebagian save lama punya pohon yang lebih mahal dari (level-1)
-- karena aturan SP dulu berbeda. Selisihnya dikunci SEKALI di kolom server
-- (bukan dihitung ulang dari save yang bisa diedit) supaya pemain lama tidak
-- kehilangan kemampuan belanja sementara cheater tidak bisa menambah offset.
alter table public.player_saves add column if not exists sp_legacy integer not null default 0;

update public.player_saves
   set sp_legacy = least(20, greatest(0,
         public._tree_cost(coalesce(save_data->'player'->'tree','{}'::jsonb))
         + greatest(0, public._int_of(coalesce(save_data->'player','{}'::jsonb), 'sp', 0))
         - (greatest(1, public._int_of(save_data, 'playerLv', 1)) - 1)))
 where sp_legacy = 0;

-- ---------- 3) MERGE: kunci rebirth + validasi progres ----------
-- Signature sengaja sama dengan 0025/0026 (tidak ada 404 untuk build lama).
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
  merged := jsonb_set(merged, '{coins}', to_jsonb(greatest(0, cur_coins - spent)), true);

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

  -- PET / ARTEFAK: id harus dikenal + slot harus menunjuk yang dimiliki.
  merged := jsonb_set(merged, '{petOwned}', public._clean_owned(merged->'petOwned', 'pet'), true);
  merged := jsonb_set(merged, '{artOwned}', public._clean_owned(merged->'artOwned', 'art'), true);

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
    'rebirth_gained',  reb_gain);
end;
$$;

-- ---------- 4) REGISTER: akun baru tidak boleh membawa progres palsu ----------
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
  v_save := jsonb_set(v_save, '{petOwned}', public._clean_owned(v_save->'petOwned', 'pet'), true);
  v_save := jsonb_set(v_save, '{artOwned}', public._clean_owned(v_save->'artOwned', 'art'), true);
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

-- ---------- 5) WORLD BOSS: damage dibatasi plafon server ----------
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
  dmg_raw   bigint;
  dmg_cap   bigint;
  save      jsonb;
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

  select username, save_data into uname, save
    from public.player_saves where user_id = v_uid limit 1;

  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  dmg_raw := greatest(0, coalesce(p_dmg, 0));
  dmg_cap := public._wb_dmg_cap(save);
  dmg_in  := least(dmg_raw, dmg_cap, public.world_boss_pool_size());

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
    'dmg_cap', dmg_cap,
    'dmg_capped', dmg_raw > dmg_in,
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

-- ---------- 6) GRANT ----------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.merge_player_state(jsonb, boolean, boolean)',
    'public.register_player(text, jsonb)',
    'public.submit_world_boss_run(bigint, bigint, text)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- helper internal: jangan pernah bisa dipanggil client
  foreach fn in array array[
    'public._num_of(jsonb, text, numeric)',
    'public._clean_stacks(jsonb)',
    'public._clean_owned(jsonb, text)',
    'public._clean_deck(jsonb, jsonb)',
    'public._clean_equip(text, jsonb)',
    'public._tree_ids(jsonb)',
    'public._tree_cost(jsonb)',
    'public._tree_ok(jsonb, integer)',
    'public._wb_dmg_cap(jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
