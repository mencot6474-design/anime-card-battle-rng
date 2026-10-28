-- 0034_roll_server.sql — Unit 4a: roll gacha server-authoritative.
-- DIBUAT OLEH _tmp/gen_0034.cjs — JANGAN SUNTING MANUAL.
-- Cermin client: js/data.js (STORY_BIBLE/TIER_CHANCE/ROLL_RARE_DEN/ART_DEFS/PET_DEFS),
-- js/panels.js (WEATHERS/TREE_NODES), js/cards-fx.js (SHINY_CHANCE_MULT/MUT_CHANCE_MULT/TRAIT_COST).
-- Regenerate: node _tmp/gen_0034.cjs  (WAJIB diulang kalau salah satu sumber itu berubah,
-- sama seperti gen_0027/gen_0028 — kalau lupa, peluang di layar beda dengan yang ditarik server).

-- 1) TABEL MIRROR
create table if not exists public.roll_config (
  key text primary key,
  val numeric not null
);

create table if not exists public.roll_pool_def (
  char_id      text primary key,
  tier         text,
  chance       numeric not null check (chance > 0),
  no_gacha     boolean not null default false,
  raid_boss    boolean not null default false,
  tower_boss   boolean not null default false,
  weather_only text
);

create table if not exists public.roll_mut_rates (
  mut         text primary key,
  chance_mult numeric not null,
  ord         integer not null default 0
);

-- Cermin luck: kind = weather | tree | art | pet.
-- Tree/art/pet = penyumbang FLAT & PCT; weather = pengali langsung (bukan flat/pct).
-- Tabel cermin 0027 (tree_node/art_def/pet_def) cuma nyimpen id/harga, jadi luck-nya
-- harus ditaruh sendiri di sini supaya server bisa menghitung totalLuck() sendiri.
create table if not exists public.luck_def (
  kind text not null,
  id   text not null,
  flat numeric not null default 0,
  pct  numeric not null default 0,
  mult numeric not null default 1,
  primary key (kind, id)
);

do $$
declare t text;
begin
  foreach t in array array['roll_config','roll_pool_def','roll_mut_rates','luck_def'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to service_role', t);
  end loop;
end $$;

-- 2) SEED (insert ... on conflict do update = idempoten, bisa dijalankan ulang)
insert into public.roll_config (key, val) values
  ('shiny_chance_mult',50),
  ('roll_rare_den',50000),
  ('trait_cost',500),
  ('luck_allow_cap',6),
  ('ledger_enforce',0)
on conflict (key) do update set val = excluded.val;

insert into public.roll_pool_def (char_id, tier, chance, no_gacha, raid_boss, tower_boss, weather_only) values
  ('CH_UNSTOPPABLE_FIST',NULL,100,true,false,false,NULL),
  ('CH_COPY_NINJA',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_DARK_AVENGER',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_PROMISED_CHILD',NULL,100,true,false,false,NULL),
  ('CH_SIX_PATHS_OF_PAIN',NULL,100,true,false,false,NULL),
  ('CH_BIJUU_BEAST',NULL,100,true,false,false,NULL),
  ('CH_ULTIMATE_WARRIOR',NULL,100,true,false,false,NULL),
  ('CH_BODY_SWITCHER',NULL,100,true,false,false,NULL),
  ('CH_NAMEKIAN_SAGE',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_PRIDEFUL_PRINCE',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_EARTHS_STRONGEST',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_GALACTIC_TYRANT',NULL,100,true,false,false,NULL),
  ('CH_CURSED_DOLL',NULL,100,true,false,false,NULL),
  ('CH_SHADOW_SUMMONER',NULL,100,true,false,false,NULL),
  ('CH_CURSED_FIST',NULL,100,true,false,false,NULL),
  ('CH_RIKAS_BLESSING',NULL,100,true,false,false,NULL),
  ('CH_LIMITLESS_MASTER',NULL,100,true,false,false,NULL),
  ('CH_KING_OF_CURSES',NULL,100,true,false,false,NULL),
  ('CH_PORCO_PILLAR',NULL,100,true,false,false,NULL),
  ('CH_AWAKENED_STAND_USER',NULL,100,true,false,false,NULL),
  ('CH_GOLD_EXPERIENCE Requiem',NULL,100,true,false,false,NULL),
  ('CH_THE WORLD',NULL,100,true,false,false,NULL),
  ('CH_OPALESTONE_DREAM',NULL,100,true,false,false,NULL),
  ('CH_HEAVENS_DOOR',NULL,100,true,false,false,NULL),
  ('CH_TANJIRO_BLADE',NULL,100,true,false,false,NULL),
  ('CH_NEZUKO_BAMBOO',NULL,100,true,false,false,NULL),
  ('CH Zenitsu_THUNDER',NULL,100,true,false,false,NULL),
  ('CH_INUIZO_MASK',NULL,100,true,false,false,NULL),
  ('CH_SANEMI_WIND',NULL,100,true,false,false,NULL),
  ('CH_SHINOBU_BUTTERFLY',NULL,100,true,false,false,NULL),
  ('CH_RULER',NULL,850000000,false,false,false,NULL),
  ('CH_OTHERWORLDLY',NULL,1000000000,false,false,false,NULL),
  ('CH_DEVIL_HUNTER',NULL,450000000,false,false,false,NULL),
  ('CH_NINE_TAIL',NULL,450000000,false,false,false,NULL),
  ('CH_SHADOW_HEIR',NULL,300000000,false,false,false,NULL),
  ('CH_FABLED_SOLDIER',NULL,200000000,false,false,false,NULL),
  ('CH_IMMORTAL_COLOSSUS',NULL,175000000,false,false,false,NULL),
  ('CH_TRICKSTER_ACE',NULL,125000000,false,false,false,NULL),
  ('CH_UNDYING_ROGUE',NULL,60000000,false,false,false,NULL),
  ('CH_SHADOW_MONARCH',NULL,40000000,false,false,false,NULL),
  ('CH_SHADOW_KING',NULL,100000000,false,true,false,NULL),
  ('CH_ROYAL_VANGUARD',NULL,30000000,false,false,false,NULL),
  ('CH_REGRESSOR',NULL,18000000,false,false,false,NULL),
  ('CH_SIXFOLD_PROPHET',NULL,12000000,false,false,false,NULL),
  ('CH_THRILLER_KING',NULL,10000000,false,false,false,NULL),
  ('CH_THREEBLADE_RONIN',NULL,9000000,false,false,false,NULL),
  ('CH_WILDHEART_HUNTER',NULL,50000,false,false,false,NULL),
  ('CH_SUNBREATH_SWORDSMAN',NULL,6000,false,false,false,NULL),
  ('CH_YOUNG_SHADOW_HEIR',NULL,3000,false,false,false,NULL),
  ('CH_YOUNG_SPIRIT_VESSEL',NULL,1400,false,false,false,NULL),
  ('CH_DARKIN_LORD',NULL,10000000,false,false,false,'awakened'),
  ('CH_PSYCHIC_ESPER',NULL,40000000,false,false,false,'awakened'),
  ('CH_SUN_GOD',NULL,25000000,false,false,false,'awakened'),
  ('CH_ABSOLUTE_ZERO',NULL,1600000,false,false,false,'iceage'),
  ('CH_ICE_QUEEN',NULL,3500000,false,false,false,'iceage'),
  ('CH_THE_STRUGGLER',NULL,3500000,false,false,false,'eclipse'),
  ('CH_WHITE_HAWK',NULL,5000000,false,false,false,'eclipse'),
  ('CH_HAVOC_WREACKER',NULL,25000000,false,false,false,'arcane'),
  ('CH_TIME_TRICKSTER',NULL,15000000,false,false,false,'arcane'),
  ('CH_YORDLE_INVENTOR',NULL,18000000,false,false,false,'arcane'),
  ('CH_DUMB_HAIR_GUY',NULL,13000000,false,false,false,'goofy'),
  ('CH_DUMB_STRETCHY_GUY',NULL,13000000,false,false,false,'goofy'),
  ('CH_GLITCHED_ENTITY',NULL,8000000,false,false,false,'glitch'),
  ('CH_THE_GRIEFER',NULL,16000000,false,false,false,'glitch'),
  ('CH_HEIGHT_OF_PAINTING',NULL,7000000,false,false,false,'doodle'),
  ('CH_INK_ANAMLOY',NULL,3500000,false,false,false,'doodle'),
  ('CH_BLIZZARD_BADDIE',NULL,80000,false,false,false,'windy'),
  ('CH_PAPER_PAL',NULL,50000,false,false,false,'windy'),
  ('CH_BLESSED_MAGE',NULL,150000,false,false,false,'lightrain'),
  ('CH_THUNDER_PRODIGY',NULL,150000,false,false,false,'lightrain'),
  ('CH_10TH_CAPTAIN',NULL,175000,false,false,false,'snowfall'),
  ('CH_OCEANS_GUARDIAN',NULL,500000,false,false,false,'snowfall'),
  ('CH_IMMORTAL_VAMPIRE',NULL,330000,false,false,false,'thunderstorm'),
  ('CH_SEA_SOVEREIGN',NULL,700000,false,false,false,'thunderstorm'),
  ('CH_PUPPETEER',NULL,280000,false,false,false,'sandstorm'),
  ('CH_SAND_VESSEL',NULL,350000,false,false,false,'sandstorm'),
  ('CH_BLESSED_SORCERER',NULL,850000,false,false,false,'monsoon'),
  ('CH_MOON_MOTHER',NULL,1000000,false,false,false,'monsoon'),
  ('CH_ALMIGHTY_TYRANT',NULL,1200000,false,false,false,'aurora'),
  ('CH_DEMON_SLIME',NULL,2200000,false,false,false,'aurora'),
  ('CH_LUCK_VOLTIA',NULL,12000,false,false,false,NULL),
  ('CH_NOBLE_COMPANION',NULL,25000,false,false,false,NULL),
  ('CH_BLOODMOON_DEMON',NULL,30000,false,false,false,NULL),
  ('CH_GREEN_BEAST',NULL,100000,false,false,false,NULL),
  ('CH_DRAGON_SIN',NULL,200000,false,false,false,NULL),
  ('CH_FROST_WIZARD',NULL,280000,false,false,false,NULL),
  ('CH_RUBBERBOUND_CAPTAIN',NULL,400000,false,false,false,NULL),
  ('CH_ICE_REAPER',NULL,400000,false,false,false,NULL),
  ('CH_FROSTBANE',NULL,550000,false,false,false,NULL),
  ('CH_COPYBLADE_MENTOR',NULL,800000,false,false,false,NULL),
  ('CH_NULLBLADE_KNIGHT',NULL,1100000,false,false,false,NULL),
  ('CH_TITAN_HUNTER',NULL,1500000,false,false,false,NULL),
  ('CH_CRIMSON_WARLORD',NULL,1800000,false,false,false,NULL),
  ('CH_LIGHTBORNE_ADMIRAL',NULL,3000000,false,false,false,NULL),
  ('CH_SOUL_REAPER',NULL,3000000,false,false,false,NULL),
  ('CH_GALACTIC_TYRANT',NULL,5000000,false,false,false,NULL),
  ('CH_SOLAR_BRAWLER',NULL,6000000,false,false,false,NULL),
  ('CH_TREMOR_EMPEROR',NULL,800000000,false,false,false,NULL),
  ('CH_ANT_KING',NULL,1000000000,false,false,false,NULL),
  ('CH_TIME_MASTER',NULL,3000000000,false,false,false,NULL),
  ('CH_OMNI_SOVEREIGN',NULL,5000000000,false,false,false,NULL),
  ('CH_ASTRAL_DEVOURER',NULL,10000000000,false,false,false,NULL),
  ('CH_BALD_KING',NULL,1500000,false,false,false,'galactic'),
  ('CH_METEOR_CONQUEROR',NULL,1000000,false,false,false,'galactic'),
  ('CH_ETERNAL_DRAGON',NULL,25000000,false,true,false,NULL)
on conflict (char_id) do update set
  tier = excluded.tier, chance = excluded.chance, no_gacha = excluded.no_gacha,
  raid_boss = excluded.raid_boss, tower_boss = excluded.tower_boss, weather_only = excluded.weather_only;

delete from public.roll_pool_def where char_id not in ('CH_UNSTOPPABLE_FIST','CH_COPY_NINJA','CH_AWAKENED_DARK_AVENGER','CH_AWAKENED_PROMISED_CHILD','CH_SIX_PATHS_OF_PAIN','CH_BIJUU_BEAST','CH_ULTIMATE_WARRIOR','CH_BODY_SWITCHER','CH_NAMEKIAN_SAGE','CH_AWAKENED_PRIDEFUL_PRINCE','CH_AWAKENED_EARTHS_STRONGEST','CH_AWAKENED_GALACTIC_TYRANT','CH_CURSED_DOLL','CH_SHADOW_SUMMONER','CH_CURSED_FIST','CH_RIKAS_BLESSING','CH_LIMITLESS_MASTER','CH_KING_OF_CURSES','CH_PORCO_PILLAR','CH_AWAKENED_STAND_USER','CH_GOLD_EXPERIENCE Requiem','CH_THE WORLD','CH_OPALESTONE_DREAM','CH_HEAVENS_DOOR','CH_TANJIRO_BLADE','CH_NEZUKO_BAMBOO','CH Zenitsu_THUNDER','CH_INUIZO_MASK','CH_SANEMI_WIND','CH_SHINOBU_BUTTERFLY','CH_RULER','CH_OTHERWORLDLY','CH_DEVIL_HUNTER','CH_NINE_TAIL','CH_SHADOW_HEIR','CH_FABLED_SOLDIER','CH_IMMORTAL_COLOSSUS','CH_TRICKSTER_ACE','CH_UNDYING_ROGUE','CH_SHADOW_MONARCH','CH_SHADOW_KING','CH_ROYAL_VANGUARD','CH_REGRESSOR','CH_SIXFOLD_PROPHET','CH_THRILLER_KING','CH_THREEBLADE_RONIN','CH_WILDHEART_HUNTER','CH_SUNBREATH_SWORDSMAN','CH_YOUNG_SHADOW_HEIR','CH_YOUNG_SPIRIT_VESSEL','CH_DARKIN_LORD','CH_PSYCHIC_ESPER','CH_SUN_GOD','CH_ABSOLUTE_ZERO','CH_ICE_QUEEN','CH_THE_STRUGGLER','CH_WHITE_HAWK','CH_HAVOC_WREACKER','CH_TIME_TRICKSTER','CH_YORDLE_INVENTOR','CH_DUMB_HAIR_GUY','CH_DUMB_STRETCHY_GUY','CH_GLITCHED_ENTITY','CH_THE_GRIEFER','CH_HEIGHT_OF_PAINTING','CH_INK_ANAMLOY','CH_BLIZZARD_BADDIE','CH_PAPER_PAL','CH_BLESSED_MAGE','CH_THUNDER_PRODIGY','CH_10TH_CAPTAIN','CH_OCEANS_GUARDIAN','CH_IMMORTAL_VAMPIRE','CH_SEA_SOVEREIGN','CH_PUPPETEER','CH_SAND_VESSEL','CH_BLESSED_SORCERER','CH_MOON_MOTHER','CH_ALMIGHTY_TYRANT','CH_DEMON_SLIME','CH_LUCK_VOLTIA','CH_NOBLE_COMPANION','CH_BLOODMOON_DEMON','CH_GREEN_BEAST','CH_DRAGON_SIN','CH_FROST_WIZARD','CH_RUBBERBOUND_CAPTAIN','CH_ICE_REAPER','CH_FROSTBANE','CH_COPYBLADE_MENTOR','CH_NULLBLADE_KNIGHT','CH_TITAN_HUNTER','CH_CRIMSON_WARLORD','CH_LIGHTBORNE_ADMIRAL','CH_SOUL_REAPER','CH_GALACTIC_TYRANT','CH_SOLAR_BRAWLER','CH_TREMOR_EMPEROR','CH_ANT_KING','CH_TIME_MASTER','CH_OMNI_SOVEREIGN','CH_ASTRAL_DEVOURER','CH_BALD_KING','CH_METEOR_CONQUEROR','CH_ETERNAL_DRAGON');

insert into public.roll_mut_rates (mut, chance_mult, ord) values
  ('none',1,0),
  ('gold',100,1),
  ('rainbow',10000,2),
  ('secret',1000000,3),
  ('ultima',100000000,4)
on conflict (mut) do update set chance_mult = excluded.chance_mult, ord = excluded.ord;

insert into public.luck_def (kind, id, flat, pct, mult) values
  ('weather','awakened',0,0,15),
  ('weather','arcane',0,0,10),
  ('weather','goofy',0,0,7),
  ('weather','glitch',0,0,6),
  ('weather','doodle',0,0,5),
  ('weather','eclipse',0,0,4),
  ('weather','iceage',0,0,3.5),
  ('weather','galactic',0,0,3),
  ('weather','aurora',0,0,2.5),
  ('weather','monsoon',0,0,2),
  ('weather','sandstorm',0,0,1.3),
  ('weather','thunderstorm',0,0,1.4),
  ('weather','snowfall',0,0,1.25),
  ('weather','lightrain',0,0,1.2),
  ('weather','windy',0,0,1.1),
  ('tree','root',0,0,1),
  ('tree','lk1',5,0,1),
  ('tree','lk2',10,0,1),
  ('tree','lk3',15,0,1),
  ('tree','lk4',20,0,1),
  ('tree','lk5',25,0.1,1),
  ('tree','sp1',0,0,1),
  ('tree','sp2',0,0,1),
  ('tree','sp3',0,0,1),
  ('tree','sp4',0,0,1),
  ('tree','sp5',0,0,1),
  ('tree','bst1',50,0.25,1),
  ('tree','bst2',50,0.25,1),
  ('tree','bst3',50,0.25,1),
  ('tree','bst4',50,0.25,1),
  ('tree','bst5',100,0.5,1),
  ('art','manik',5,0,1),
  ('art','medal',10,10,1),
  ('art','giok',25,0,1),
  ('art','batu',0,25,1),
  ('art','cincin',50,30,1),
  ('art','intan',75,75,1),
  ('art','pedang-api',120,100,1),
  ('art','helm-abyss',80,120,1),
  ('art','tameng-surgawi',50,200,1),
  ('art','tome-infinity',150,200,1),
  ('pet','doll',10,0,1),
  ('pet','otherworldly',25,0,1),
  ('pet','titan',50,0,1),
  ('pet','dragon',50,15,1),
  ('pet','nine-tail',50,25,1),
  ('pet','bijuu',100,50,1),
  ('pet','kyubi',200,300,1),
  ('pet','nebula-wisp',150,220,1),
  ('pet','next-bot',120,150,1),
  ('pet','cyber-kitsune',250,300,1)
on conflict (kind, id) do update set flat = excluded.flat, pct = excluded.pct, mult = excluded.mult;

delete from public.luck_def where (kind, id) not in (('weather','awakened'),('weather','arcane'),('weather','goofy'),('weather','glitch'),('weather','doodle'),('weather','eclipse'),('weather','iceage'),('weather','galactic'),('weather','aurora'),('weather','monsoon'),('weather','sandstorm'),('weather','thunderstorm'),('weather','snowfall'),('weather','lightrain'),('weather','windy'),('tree','root'),('tree','lk1'),('tree','lk2'),('tree','lk3'),('tree','lk4'),('tree','lk5'),('tree','sp1'),('tree','sp2'),('tree','sp3'),('tree','sp4'),('tree','sp5'),('tree','bst1'),('tree','bst2'),('tree','bst3'),('tree','bst4'),('tree','bst5'),('art','manik'),('art','medal'),('art','giok'),('art','batu'),('art','cincin'),('art','intan'),('art','pedang-api'),('art','helm-abyss'),('art','tameng-surgawi'),('art','tome-infinity'),('pet','doll'),('pet','otherworldly'),('pet','titan'),('pet','dragon'),('pet','nine-tail'),('pet','bijuu'),('pet','kyubi'),('pet','nebula-wisp'),('pet','next-bot'),('pet','cyber-kitsune'));

-- 3) HELPERS
create or replace function public._roll_shiny_chance_mult()
returns numeric language sql stable as $$ select coalesce((select val from public.roll_config where key='shiny_chance_mult'),50) $$;

create or replace function public._roll_rare_den()
returns numeric language sql stable as $$ select coalesce((select val from public.roll_config where key='roll_rare_den'),50000) $$;

/* Cermin rollCommonScale() (data.js:34) — K penetap bobot common, dihitung dengan L=1. */
create or replace function public._roll_common_scale(p_save jsonb, p_aw text)
returns numeric
language plpgsql stable
as $$
declare
  rare_sum numeric := 0;
  common_sum numeric := 0;
  v_r record;
  v_m record;
  base numeric;
  den numeric;
  sm_c numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'),50);
  rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'),50000);
begin
  for v_r in select rp.char_id, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
             from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(v_r.no_gacha,false) then continue; end if;
    if (v_r.raid_boss or v_r.tower_boss) then
      if not (
        (coalesce(p_save->'raidShopOwned','{}'::jsonb) ? v_r.char_id) or
        (coalesce(p_save->'towerShopOwned','{}'::jsonb) ? v_r.char_id) or
        exists(select 1 from jsonb_array_elements(coalesce(p_save->'stacks','[]'::jsonb)) s where s->>'char'=v_r.char_id)
      ) then continue; end if;
    end if;
    if v_r.weather_only is not null and v_r.weather_only <> coalesce(p_aw,'') then continue; end if;
    base := coalesce(v_r.chance,0);
    if base <= 0 then continue; end if;
    for v_m in select mut, chance_mult from public.roll_mut_rates order by ord loop
      den := base * sm_c * coalesce(v_m.chance_mult,1);
      if den >= rare_den then rare_sum := rare_sum + 1.0/den; else common_sum := common_sum + 1.0/den; end if;
      den := base * coalesce(v_m.chance_mult,1);
      if den >= rare_den then rare_sum := rare_sum + 1.0/den; else common_sum := common_sum + 1.0/den; end if;
    end loop;
  end loop;
  rare_sum := least(0.5, rare_sum);
  if common_sum <= 0 then return 1.0; end if;
  return (1.0 - rare_sum)/common_sum;
end;
$$;

/* Cermin dupSellValue() client (panels.js:633) — nilai kompensasi dup -> rebirth essence.
   PENTING: 75 dari 105 unit TIDAK punya field tier, jadi client jatuh ke jalur
   "band peluang" (chance >= 1jt -> 600, dst). Versi lama cuma lihat tier dan diam-diam
   bayar 20 essence untuk kartu tier-less -> player rugi essence = drift ekonomi.
   Urutan cabang harus SAMA dengan client: tier dikenal ? tier : (chance>0 ? band : 20). */
create or replace function public._dup_sell_value(p_tier text, p_chance numeric, p_mut text, p_shiny boolean)
returns numeric language sql stable as $$
  select round(
    (case
       when p_tier in ('R','SR','SSR','UR','EX','BOSS') then
         case p_tier when 'R' then 20 when 'SR' then 40 when 'SSR' then 90
                     when 'UR' then 220 when 'EX' then 600 when 'BOSS' then 600 end
       when coalesce(p_chance,0) > 0 then
         case when p_chance >= 1000000 then 600
              when p_chance >=  500000 then 220
              when p_chance >=  150000 then  90
              when p_chance >=   50000 then  40
              else 20 end
       else 20 end)
    * (case coalesce(p_mut,'none') when 'gold' then 2 when 'rainbow' then 3 when 'secret' then 5 when 'ultima' then 8 else 1 end)
    * (case when p_shiny then 2 else 1 end)
  )
$$;
/* signature lama (3 arg) harus dibuang: kalau tidak, overload mati jalan terus. */
drop function if exists public._dup_sell_value(text,text,boolean);

/* Cermin totalLuck() (data.js:93) TANPA buff sesi (potion & iklan) yang tidak
   terlihat server. Rumus client:
     (luckBase + flat) * (1 + pct) * weatherLuckMult * globalLuckMult * rebirthLuckMult * adLuckMult
   flat/pct = player.luckFlat + tree + art terpasang + pet (ketiganya dari luck_def),
   dan player.luckBase/luckFlat/luckPercent sudah jadi milik server sejak 0027. */
create or replace function public._luck_of(p_save jsonb)
returns numeric
language plpgsql stable
as $$
declare
  v_player jsonb := coalesce(p_save->'player','{}'::jsonb);
  v_tree   jsonb := coalesce(p_save->'player','{}'::jsonb)->'tree';
  v_base   numeric := coalesce((v_player->>'luckBase')::numeric, (v_player->>'luck')::numeric, 1);
  v_flat   numeric := coalesce((v_player->>'luckFlat')::numeric, 0);
  v_pct    numeric := coalesce((v_player->>'luckPercent')::numeric, 0);
  v_tf     numeric; v_tp numeric;
  v_af     numeric; v_ap numeric;
  v_pf     numeric; v_pp numeric;
  v_aw     text;
  v_wmult  numeric := 1;
  v_gmult  numeric := 1;
  v_rmult  numeric := 1;
begin
  select coalesce(sum(flat),0), coalesce(sum(pct),0) into v_tf, v_tp
    from public.luck_def
   where kind='tree' and coalesce((v_tree->>id) in ('true','1'), false);
  v_flat := v_flat + v_tf; v_pct := v_pct + v_tp;

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_af, v_ap
    from jsonb_array_elements_text(coalesce(p_save->'artSlots','[]'::jsonb)) as slot_id
    join public.luck_def ld on ld.kind='art' and ld.id = slot_id
   where slot_id is not null;
  v_flat := v_flat + coalesce(v_af,0); v_pct := v_pct + coalesce(v_ap,0);

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_pf, v_pp
    from public.luck_def ld
   where ld.kind='pet' and ld.id = nullif(p_save->>'petEquipped','');
  v_flat := v_flat + coalesce(v_pf,0); v_pct := v_pct + coalesce(v_pp,0);

  if v_pct < -0.99 then v_pct := -0.99; end if;

  if p_save->'weather' is not null
     and coalesce((p_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint then
    v_aw := p_save->'weather'->>'id';
    select coalesce(mult,1) into v_wmult from public.luck_def where kind='weather' and id = v_aw;
    v_wmult := coalesce(v_wmult,1);
  end if;

  /* Global luck = evento server (dibeli lewat buy_global_luck, 0016/0024). */
  select coalesce(multiplier,1) into v_gmult
    from public.global_luck where ends_at > now() order by ends_at desc limit 1;
  v_gmult := coalesce(v_gmult,1);

  /* rebirthLuckMult() = 1 + jumlah rebirth (state.js:375). count dimiliki server sejak 0027. */
  v_rmult := 1 + greatest(0, coalesce((p_save->'rebirth'->>'count')::integer, 0));

  return greatest(1, (v_base + v_flat) * (1 + v_pct) * v_wmult * v_gmult * v_rmult);
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public._roll_shiny_chance_mult()',
    'public._roll_rare_den()',
    'public._roll_common_scale(jsonb,text)',
    'public._dup_sell_value(text,numeric,text,boolean)',
    'public._luck_of(jsonb)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end $$;

-- 4) RPC roll_pull
create or replace function public.roll_pull(
  p_count integer default 1,
  p_pack  text    default null,
  p_luck  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$

declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_save    jsonb;
  v_aw      text;
  v_cnt     integer := greatest(1, least(coalesce(p_count,1), 100));
  v_use_pack boolean := p_pack is not null and p_pack <> '';
  v_pack_def record;
  v_owned   integer := 0;
  v_use     integer := 0;
  v_res     jsonb := '[]'::jsonb;
  v_r       record;
  v_m       record;
  v_pick    jsonb;
  v_dup     boolean;
  v_ess     numeric := 0;
  v_new_count integer := 0;
  v_dup_count integer := 0;
  v_rarest_ch numeric := -1e18;
  v_rarest  jsonb := NULL;
  v_stacks  jsonb := '[]'::jsonb;
  v_new     jsonb := '[]'::jsonb;
  v_ns      jsonb;
  v_s       jsonb;
  v_i       integer;
  v_ns_id   text;
  v_eff     numeric;
  v_ch      numeric;
  v_l       numeric;
  v_l_srv   numeric;
  v_sm_c    numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'), 50);
  v_rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'), 50000);
  v_k       numeric;
  v_total   numeric := 0;
  v_rnd     numeric;
  v_acc     numeric := 0;
  v_entries jsonb[] := '{}';
  v_w       numeric;

begin

  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if v_use_pack then
    select * into v_pack_def from public.pack_def where id = p_pack;
    if not found then
      return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
    end if;
    select coalesce((v_save->'rollPacks')->>(p_pack),'0')::integer into v_owned;
    v_use := v_cnt;
    if v_owned < v_use then
      return jsonb_build_object('ok',false,'msg','PACK_EMPTY');
    end if;
    v_save := jsonb_set(v_save, array['rollPacks', p_pack], to_jsonb(v_owned - v_use));
  end if;

  v_aw := case when v_save->'weather' is not null
               and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
          then v_save->'weather'->>'id' else null end;

  /* Luck: server hitung sendiri dari cermin, client cuma boleh naik di atasnya
     sebatas buff sesi (potion/iklan) x luck_allow_cap. see _luck_of(). */
  v_l_srv := public._luck_of(v_save);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_k := public._roll_common_scale(v_save, v_aw);
  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);

  for v_r in select rp.char_id, rp.tier, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
             from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(v_r.no_gacha,false) then continue; end if;
    if (v_r.raid_boss or v_r.tower_boss) then
      if not (
        (coalesce(v_save->'raidShopOwned','{}'::jsonb) ? v_r.char_id) or
        (coalesce(v_save->'towerShopOwned','{}'::jsonb) ? v_r.char_id) or
        exists(select 1 from jsonb_array_elements(v_stacks) s where s->>'char'=v_r.char_id)
      ) then continue; end if;
    end if;
    if v_r.weather_only is not null and v_r.weather_only <> coalesce(v_aw,'') then continue; end if;
    if coalesce(v_r.chance,0) <= 0 then continue; end if;
    for v_m in select m.mut, m.chance_mult from public.roll_mut_rates m order by m.ord loop
      /* shiny = true */
      v_ch := v_r.chance * v_sm_c * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := v_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',true,'ch',v_ch,'bc',v_r.chance,'w',v_w));
      /* shiny = false */
      v_ch := v_r.chance * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := v_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',false,'ch',v_ch,'bc',v_r.chance,'w',v_w));
    end loop;
  end loop;

  if v_total <= 0 or array_length(v_entries,1) is null then
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  for v_i in 1..v_cnt loop
    v_rnd := random() * v_total;
    v_acc := 0;
    v_pick := NULL;
    foreach v_s in array v_entries loop
      v_acc := v_acc + (v_s->>'w')::numeric;
      if v_rnd <= v_acc then v_pick := v_s; exit; end if;
    end loop;
    if v_pick is NULL then v_pick := v_entries[array_length(v_entries,1)]; end if;
    v_dup := false;
    for v_s in select jsonb_array_elements(v_stacks) loop
      if (v_s->>'char') = (v_pick->>'char')
         and coalesce(nullif(v_s->>'mut',''),'none') = (v_pick->>'mut')
         and ((v_s->>'shiny') in ('true','1')) = ((v_pick->>'shiny')='true') then
        v_dup := true; exit;
      end if;
    end loop;
    v_eff := ceil((v_pick->>'ch')::numeric / v_l);
    if v_dup then
      v_dup_count := v_dup_count + 1;
      v_ess := v_ess + public._dup_sell_value(v_pick->>'tier', (v_pick->>'bc')::numeric, v_pick->>'mut', (v_pick->>'shiny')='true');
      v_res := v_res || jsonb_build_array(jsonb_build_object(
        'cardId',v_pick->>'char','tier',v_pick->>'tier','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true',
        'chance',(v_pick->>'ch')::numeric,'eff',v_eff,'dup',true));
    else
      v_new_count := v_new_count + 1;
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text),1,9);
      /* Stack yang BARU DIBUAT server dikirim balik (v_new) supaya id client == id di DB.
         Bukan seluruh 'stacks' (74 KB), hanya yang lahir dari roll ini (<= 100 x ~130 B). */
      v_ns := jsonb_build_object(
        'id',v_ns_id,'char',v_pick->>'char','tier',v_pick->>'tier','fav',false,'lock',false,
        'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','trait','none','count',1);
      v_stacks := v_stacks || jsonb_build_array(v_ns);
      v_new := v_new || jsonb_build_array(v_ns);
      v_res := v_res || jsonb_build_array(jsonb_build_object(
        'cardId',v_pick->>'char','tier',v_pick->>'tier','stackId',v_ns_id,
        'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true',
        'chance',(v_pick->>'ch')::numeric,'eff',v_eff,'dup',false));
      if (v_pick->>'ch')::numeric > v_rarest_ch then
        v_rarest_ch := (v_pick->>'ch')::numeric;
        v_rarest := jsonb_build_object('char',v_pick->>'char','mut',v_pick->>'mut',
          'shiny',(v_pick->>'shiny')='true','ch',v_rarest_ch);
      end if;
    end if;
  end loop;

  v_save := jsonb_set(v_save, '{stacks}', v_stacks);
  if v_ess > 0 then
    if v_save->'rebirth' is null then v_save := jsonb_set(v_save, '{rebirth}', jsonb_build_object('count',0,'essence',0)); end if;
    v_save := jsonb_set(v_save, array['rebirth','essence'], to_jsonb(coalesce((v_save->'rebirth'->>'essence')::numeric,0) + v_ess));
  end if;
  v_save := jsonb_set(v_save, '{totalRolls}', to_jsonb(coalesce((v_save->>'totalRolls')::bigint,0) + v_cnt));

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  /* TIDAK mengembalikan seluruh 'stacks' (74 KB di save terukur) — hanya yang baru lahir
     ('newStacks') + saldo pack + delta essence/totalRolls. Hemat egress free tier. */
  return jsonb_build_object('ok',true,'results',v_res,'total',v_cnt,
    'newStacks',v_new,'rollPacks',coalesce(v_save->'rollPacks','{}'::jsonb),
    'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,
    'rarestPull',v_rarest,'luck',v_l,'luckServer',v_l_srv);

end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.roll_pull(integer,text,numeric)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
