-- ============================================================================
-- 0041 — bulk_roll: MEMAKAI PACK jadi kejadian server (Unit 5b-2)
-- ============================================================================
-- LUBANG. `bpUseRollPack` (panels.js:1962) memotong `state.rollPacks[key]` di browser lalu
-- langsung `instantRollFast(100000 × use, true)`. Server tidak pernah diajak bicara, jadi
-- F12 `state.rollPacks.r100k = 6` padahal ledger cuma 1 = 6×100.000 tarikan KARTU seharga
-- satu pack. Mata uangnya memang tetap utuh (`player_packs` dibetulkan merge) — yang bocor
-- kartunya, dan `_validate_stacks_ledger` masih shadow (`ledger_enforce = 0`) jadi kartu
-- hasil curang itu bertahan di save.
--
-- YANG DIBUAT DI SINI
--  1) `bulk_roll(p_pack, p_qty, p_luck)` — konsumsi dari LEDGER `player_packs` (`for update`,
--     jadi satu pack tidak bisa dipakai dua RPC sekaligus), jumlah tarikan dari
--     `pack_def.pulls` (kolom yang dibuat 0040) sehingga "1 pack = berapa roll" tidak pernah
--     datang dari parameter client. Menulis stacks + esens dup + totalRolls ke save, mencatat
--     hasil di `roll_ledger`, dan membalas hasil TERAGREGASI per varian + saldo pack final.
--  2) `roll_ledger` — ledger AGREGAT (username, pack, kartu, mut, shiny, dup → n).
--     `roll_history` 1 baris per tarikan dan tidak akan pernah muat 100.000 pull per pack;
--     yang dibutuhkan validator cuma "varian ini pernah dilahirkan server", bukan riwayat
--     per-riwayatan.
--  3) `_roll_entries(p_save, p_aw, p_l)` — pembobotan varian, SATU-SATUNYA implementasi.
--     `roll_pull` versi 0041 ikut memanggil helper ini (superseed 0036 — pola yang sama:
--     0036 men-supersede roll_pull 0034, 0040 men-supersede claim_daily_gem 0023/0025), jadi
--     kedua jalur acak tidak bisa drift. Ini aman terhadap workflow generator: kalau
--     `gen_0034.cjs`/`gen_0036.cjs` dijalankan ulang dan di-apply, 0041 tetap menang karena
--     apply mengikuti urutan nomor file dan 0041 > 0036.
--
-- SAMPLER (kenapa tidak loop 100k iterasi). Alokasi multinomial difaktorkan jadi rangkaian
--   binomial bersyarat — X_i ~ Bin(remaining, w_i / Σw_sisa) — yang distribusi gabungannya
--   IDENTIK dengan multinomial, tapi biayanya O(jumlah varian) ≈ 1050, bukan O(jumlah pull).
--   Varian diproses ASC menurut bobot supaya bin TERAKHIR (paling umum, p = 1 di langkah itu)
--   yang menyerap sisa pembulatan — bukan bin terlangka. `_bulk_count` memilih penumpang:
--   exact inverse-CDF untuk n ≤ 200 (dan kasus sisanya terbukti n < 240), normal-approx untuk
--   mean ≥ 12 dan var ≥ 8, Poisson (Knuth) untuk p ≤ 0,05.
--
-- BELUM DIUNIT INI (sengaja): aturan `_rebuild_packs` yang MENERIMA penurunan pack dari client
--   dibiarkan, karena jalur tower (`instantRoll`/`pendingRolls`) dan reward iklan masih consume
--   di browser. Aturan itu baru boleh dicabut setelah SEMUA jalur konsumsi pindah ke RPC —
--   bersamaan dengan `ledger_enforce = 1`.

-- ============================================================================
-- 1) LEDGER AGREGAT
-- ============================================================================
create table if not exists public.roll_ledger (
  username text    not null,
  user_id  uuid,
  pack     text    not null default 'none',
  card_id  text    not null,
  mut      text    not null,
  shiny    boolean not null,
  dup      boolean not null,
  n        integer not null check (n > 0),
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  primary key (username, pack, card_id, mut, shiny, dup)
);

create index if not exists idx_roll_ledger_variant
  on public.roll_ledger (username, card_id, mut, shiny)
  where dup = false;

do $$
begin
  execute 'alter table public.roll_ledger enable row level security';
  execute 'revoke all on table public.roll_ledger from public, anon, authenticated';
end $$;

insert into public.roll_config (key, val) values ('bulk_max_packs', '10')
on conflict (key) do nothing;

-- ============================================================================
-- 2) SAMPLER
-- ============================================================================
-- Inverse-CDF eksak: satu uniform, cari k terkecil dengan F(k) >= u.
-- PMF-nya dibangun REKUREN (pmf(k+1) = pmf(k)·(n-k)/(k+1)·p/(1-p)) supaya tidak
-- butuh `dbinom` (tidak dijamin ada di DB ini) dan tidak kena overflow `factorial`
-- (int8, mati di n > 20). Dipanggil hanya untuk n kecil, jadi loop <= ~240.
create or replace function public._binom_small(p_n integer, p_p numeric)
returns integer
language plpgsql
as $fn$
declare
  v_u   numeric;
  v_q   numeric;
  v_pmf numeric;
  v_cdf numeric;
  v_k   integer;
begin
  if p_n is null or p_n <= 0 then return 0; end if;
  if p_p is null or p_p <= 0 then return 0; end if;
  if p_p >= 1 then return p_n; end if;
  v_u   := random();
  v_q   := p_p / (1 - p_p);
  v_pmf := power(1 - p_p, p_n);
  v_cdf := v_pmf;
  if v_cdf >= v_u then return 0; end if;
  v_k := 1;
  while v_k <= p_n loop
    v_pmf := v_pmf * (p_n - v_k + 1) / v_k * v_q;
    v_cdf := v_cdf + v_pmf;
    if v_cdf >= v_u then return v_k; end if;
    v_k := v_k + 1;
  end loop;
  return p_n;
end;
$fn$;

-- Jumlah sukses Bin(trials, prob) dengan trials besar: pilih penumpang yang valid.
create or replace function public._bulk_count(p_trials numeric, p_prob numeric)
returns integer
language plpgsql
as $fn$
declare
  v_n    integer := greatest(0, coalesce(p_trials, 0))::integer;
  v_p    numeric := least(1, greatest(0, coalesce(p_prob, 0)));
  v_mean numeric;
  v_var  numeric;
  v_z    numeric;
  v_l    numeric;
  v_prod numeric;
  v_k    integer;
begin
  if v_n <= 0 or v_p <= 0 then return 0; end if;
  if v_p >= 1 then return v_n; end if;
  v_mean := v_n * v_p;
  v_var  := v_mean * (1 - v_p);

  if v_n <= 200 then
    return public._binom_small(v_n, v_p);
  end if;

  if v_mean >= 12 and v_var >= 8 then
    /* Box-Muller; random() bisa 0 -> ln(0) = -infinity, jadi digeser. */
    v_z := sqrt(-2 * ln(greatest(1e-12, random()))) * cos(2 * pi() * random());
    return greatest(0, least(v_n, floor(v_mean + 0.5 + sqrt(v_var) * v_z)::integer));
  end if;

  if v_p <= 0.05 then
    /* Bin(n,p) ≈ Poisson(mean) untuk p kecil; Knuth, mean < 12 di cabang ini. */
    v_l := exp(-v_mean);
    v_prod := 1;
    v_k := 0;
    loop
      v_prod := v_prod * greatest(1e-12, random());
      exit when v_prod <= v_l;
      v_k := v_k + 1;
      exit when v_k > v_n;
    end loop;
    return greatest(0, least(v_n, v_k));
  end if;

  /* Kombinasi yang tersisa (p > 0,05 tapi mean < 12 dan n > 200) matematisnya
     tidak ada: n = mean/p < 12/0,05 = 240. Eksak tetap murah. */
  return public._binom_small(v_n, v_p);
end;
$fn$;

-- ============================================================================
-- 3) BOBOT VARIAN — satu implementasi untuk roll_pull dan bulk_roll
--    (potongan loop-nya disalin VERBATIM dari roll_pull 0034/0036; yang berubah
--    cuma pembungkusnya)
-- ============================================================================
create or replace function public._roll_entries(p_save jsonb, p_aw text, p_l numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_entries jsonb[] := '{}';
  v_total   numeric := 0;
  v_k       numeric;
  v_ch      numeric;
  v_w       numeric;
  v_r       record;
  v_m       record;
  v_sm_c    numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'), 50);
  v_rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'), 50000);
begin
  v_k := public._roll_common_scale(p_save, p_aw);

  for v_r in select rp.char_id, rp.tier, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
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
    if coalesce(v_r.chance,0) <= 0 then continue; end if;
    for v_m in select m.mut, m.chance_mult from public.roll_mut_rates m order by m.ord loop
      /* shiny = true */
      v_ch := v_r.chance * v_sm_c * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := p_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',true,'ch',v_ch,'bc',v_r.chance,'w',v_w));
      /* shiny = false */
      v_ch := v_r.chance * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := p_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',false,'ch',v_ch,'bc',v_r.chance,'w',v_w));
    end loop;
  end loop;

  return jsonb_build_object('total', v_total, 'entries', coalesce(to_jsonb(v_entries), '[]'::jsonb));
end;
$fn$;

-- ============================================================================
-- 4) BULK_ROLL
-- ============================================================================
create or replace function public.bulk_roll(
  p_pack text,
  p_qty  integer default 1,
  p_luck numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid       uuid := auth.uid();
  v_uname     text;
  v_save      jsonb;
  v_aw        text;
  v_pulls_one integer;
  v_req       integer := greatest(1, least(coalesce(p_qty,1), 50));
  v_max       integer := coalesce((select val from public.roll_config where key='bulk_max_packs'), 10)::integer;
  v_owned     integer := 0;
  v_use       integer := 0;
  v_pulls     bigint  := 0;
  v_l         numeric;
  v_l_srv     numeric;
  v_e         jsonb;
  v_wtot      numeric := 0;
  v_wrem      numeric := 0;
  v_w         numeric;
  v_p         numeric;
  v_entries   jsonb[];
  v_s         jsonb;
  v_x         integer;
  v_rem       bigint;
  v_stacks    jsonb;
  v_have      jsonb;
  v_key       text;
  v_has       boolean;
  v_newn      integer;
  v_dupn      integer;
  v_new       jsonb := '[]'::jsonb;
  v_res       jsonb := '[]'::jsonb;
  v_led       jsonb := '[]'::jsonb;
  v_ns        jsonb;
  v_ns_id     text;
  v_eff       numeric;
  v_ess       numeric := 0;
  v_new_count integer := 0;
  v_dup_count integer := 0;
  v_rarest_ch numeric := -1e18;
  v_rarest    jsonb := NULL;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if p_pack is null or p_pack = '' then
    return jsonb_build_object('ok',false,'msg','BAD_PACK');
  end if;

  /* "1 pack = berapa tarikan" milik server (0040). Pack tanpa kolom pulls
     (mis. pack event yang belum didaftar) TIDAK bisa dibulk — jangan pernah
     baca angka client untuk ini. */
  select pulls into v_pulls_one from public.pack_def where id = p_pack;
  if v_pulls_one is null or v_pulls_one <= 0 then
    return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
  end if;

  /* LEDGER = satu-satunya tempat jumlah pack. `for update` menutup double-spend
     (dua RPC paralel tidak bisa sama-sama melihat qty = 1). */
  select coalesce(qty,0) into v_owned
    from public.player_packs where username = v_uname and pack = p_pack for update;
  v_owned := coalesce(v_owned, 0);
  if v_owned <= 0 then
    return jsonb_build_object('ok',false,'msg','PACK_EMPTY','owned',0,
                              'rollPacks', public._packs_of(v_uname));
  end if;

  v_use   := least(v_req, v_owned, v_max);
  v_pulls := v_pulls_one::bigint * v_use;

  update public.player_packs set qty = qty - v_use
   where username = v_uname and pack = p_pack;

  v_aw := case when v_save->'weather' is not null
                and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
           then v_save->'weather'->>'id' else null end;

  /* Luck: sama persis dengan roll_pull — server yang hitung dari cermin, client
     cuma boleh naik sebatas buff sesi x luck_allow_cap. */
  v_l_srv := public._luck_of(v_save);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_e    := public._roll_entries(v_save, v_aw, v_l);
  v_wtot := coalesce((v_e->>'total')::numeric, 0);
  v_wrem := v_wtot;

  if v_wtot <= 0 or jsonb_typeof(v_e->'entries') <> 'array'
                  or jsonb_array_length(v_e->'entries') = 0 then
    /* Pool kosong = tidak ada yang bisa diacak; pack dikembalikan (satu
       transaksi, jadi explicit restore — plain RETURN tidak me-rollback). */
    update public.player_packs set qty = qty + v_use
     where username = v_uname and pack = p_pack;
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL','owned',(select coalesce(qty,0) from public.player_packs where username = v_uname and pack = p_pack));
  end if;

  select coalesce(array_agg(e order by (e->>'w')::numeric asc), '{}') into v_entries
    from jsonb_array_elements(v_e->'entries') e;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  /* Set varian yang sudah dimiliki, sekali saja (sebelumnya roll_pull memindai
     562 stacks per tarikan — di sini satu scan untuk semua bin). */
  select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) into v_have
    from (select distinct (s->>'char') || '|' ||
                 coalesce(nullif(s->>'mut',''), 'none') || '|' ||
                 case when coalesce(s->>'shiny','false') in ('true','1') then '1' else '0' end as k
          from jsonb_array_elements(v_stacks) s) t;

  v_rem := v_pulls;
  foreach v_s in array v_entries loop
    exit when v_rem <= 0;
    v_w := coalesce((v_s->>'w')::numeric, 0);
    if v_w <= 0 then continue; end if;
    v_p    := v_w / v_wrem;
    v_wrem := v_wrem - v_w;
    v_x    := public._bulk_count(v_rem, v_p);
    if v_x is null or v_x <= 0 then continue; end if;
    if v_x > v_rem then v_x := v_rem::integer; end if;
    v_rem := v_rem - v_x;

    v_key := (v_s->>'char') || '|' || (v_s->>'mut') || '|' ||
             case when (v_s->>'shiny') = 'true' then '1' else '0' end;
    v_has := (v_have ? v_key);
    /* Aturan game: 1 stack per varian. Salinan PERTAMA dari varian yang belum
       dimiliki jadi stack baru, sisanya (dan semua salinan varian yang sudah
       ada) dibayar esens dup — persis seperti loop per-tarikan roll_pull. */
    v_newn := case when v_has then 0 else 1 end;
    v_dupn := v_x - v_newn;

    v_eff := ceil((v_s->>'ch')::numeric / v_l);
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'cardId', v_s->>'char', 'tier', v_s->>'tier', 'mut', v_s->>'mut',
      'shiny', (v_s->>'shiny') = 'true', 'chance', (v_s->>'ch')::numeric,
      'eff', v_eff, 'n', v_x, 'new', v_newn, 'dup', v_dupn));

    if v_newn = 1 then
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text), 1, 9);
      v_ns := jsonb_build_object(
        'id', v_ns_id, 'char', v_s->>'char', 'tier', v_s->>'tier', 'fav', false, 'lock', false,
        'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true', 'trait', 'none', 'count', 1);
      v_stacks := v_stacks || jsonb_build_array(v_ns);
      v_new    := v_new || jsonb_build_array(v_ns);
      v_have   := jsonb_set(v_have, array[v_key], 'true'::jsonb, true);
      v_new_count := v_new_count + 1;
      v_led := v_led || jsonb_build_array(jsonb_build_object(
        'char', v_s->>'char', 'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true',
        'dup', false, 'n', 1));
      if (v_s->>'ch')::numeric > v_rarest_ch then
        v_rarest_ch := (v_s->>'ch')::numeric;
        v_rarest := jsonb_build_object('char', v_s->>'char', 'mut', v_s->>'mut',
          'shiny', (v_s->>'shiny') = 'true', 'ch', v_rarest_ch);
      end if;
    end if;

    if v_dupn > 0 then
      v_ess := v_ess + public._dup_sell_value(v_s->>'tier', (v_s->>'bc')::numeric,
                                              v_s->>'mut', (v_s->>'shiny') = 'true') * v_dupn;
      v_dup_count := v_dup_count + v_dupn;
      v_led := v_led || jsonb_build_array(jsonb_build_object(
        'char', v_s->>'char', 'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true',
        'dup', true, 'n', v_dupn));
    end if;
  end loop;

  if v_rem > 0 then
    /* Sisa (harus 0: bin terakhir punya p = 1) dibayar sebagai dup di varian
       paling umum supaya jumlah tarikan yang dijanjikan tetap keluar semua. */
    v_ess := v_ess + public._dup_sell_value(NULL, 0, 'none', false) * v_rem;
    v_dup_count := v_dup_count + v_rem::integer;
  end if;

  if jsonb_array_length(v_led) > 0 then
    insert into public.roll_ledger (username, user_id, pack, card_id, mut, shiny, dup, n)
    select v_uname, v_uid, p_pack, t->>'char', t->>'mut', (t->>'shiny') = 'true',
           (t->>'dup') = 'true', (t->>'n')::integer
      from jsonb_array_elements(v_led) t
    on conflict (username, pack, card_id, mut, shiny, dup)
      do update set n = public.roll_ledger.n + excluded.n,
                    last_at = now(),
                    user_id = coalesce(excluded.user_id, public.roll_ledger.user_id);
  end if;

  v_save := jsonb_set(v_save, '{stacks}', v_stacks);
  if v_ess > 0 then
    if v_save->'rebirth' is null then v_save := jsonb_set(v_save, '{rebirth}', jsonb_build_object('count',0,'essence',0)); end if;
    v_save := jsonb_set(v_save, array['rebirth','essence'], to_jsonb(coalesce((v_save->'rebirth'->>'essence')::numeric,0) + v_ess));
  end if;
  v_save := jsonb_set(v_save, '{totalRolls}', to_jsonb(coalesce((v_save->>'totalRolls')::bigint,0) + v_pulls));
  /* Cermin pack di save = ledger final, supaya merge berikutnya tidak melihat
     "penurunan" yang tidak bisa dijelaskan dan ikut menurunkan ledger. */
  v_save := jsonb_set(v_save, '{rollPacks}', public._packs_of(v_uname), true);

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok',true,'used',v_use,'total',v_pulls,
    'results',v_res,'newStacks',v_new,'rollPacks',public._packs_of(v_uname),
    'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,
    'rarestPull',v_rarest,'luck',v_l,'luckServer',v_l_srv);
end;
$fn$;

-- ============================================================================
-- 5) ROLL_PULL VERSI 0041 — bobot lewat _roll_entries, pack dari LEDGER
--    (sisanya salinan utuh 0036; perubahan: blok pack, blok bangun-entri, dan
--    cermin rollPacks ditulis dari ledger)
-- ============================================================================
create or replace function public.roll_pull(
  p_count integer default 1,
  p_pack  text    default null,
  p_luck  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$

declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_save    jsonb;
  v_aw      text;
  v_cnt     integer := greatest(1, least(coalesce(p_count,1), 100));
  v_use_pack boolean := p_pack is not null and p_pack <> '';
  v_owned   integer := 0;
  v_use     integer := 0;
  v_res     jsonb := '[]'::jsonb;
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
  v_l       numeric;
  v_l_srv   numeric;
  v_total   numeric := 0;
  v_rnd     numeric;
  v_acc     numeric := 0;
  v_entries jsonb[] := '{}';
  v_e       jsonb;

begin

  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if v_use_pack then
    if not exists (select 1 from public.pack_def where id = p_pack) then
      return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
    end if;
    /* 0041: pack dibaca dari LEDGER, bukan dari cermin di save. Versi 0036 memakai
       `v_save->'rollPacks'` yang memang sudah dipolice merge, tapi tetap bukan
       angka yang sama dengan `player_packs` — dua sumber kebenaran untuk satu
       mata uang. Sekaligus `for update` menutup dua RPC paralel yang sama-sama
       melihat qty = 1. */
    select coalesce(qty,0) into v_owned
      from public.player_packs where username = v_uname and pack = p_pack for update;
    v_owned := coalesce(v_owned, 0);
    v_use := v_cnt;
    if v_owned < v_use then
      return jsonb_build_object('ok',false,'msg','PACK_EMPTY','owned',v_owned);
    end if;
    update public.player_packs set qty = qty - v_use
     where username = v_uname and pack = p_pack;
    v_save := jsonb_set(v_save, '{rollPacks}', public._packs_of(v_uname), true);
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

  /* 0041: bobot dibangun oleh helper bersama — identitas dengan bulk_roll. */
  v_e := public._roll_entries(v_save, v_aw, v_l);
  v_total := coalesce((v_e->>'total')::numeric, 0);
  select coalesce(array_agg(e), '{}') into v_entries from jsonb_array_elements(v_e->'entries') e;

  if v_total <= 0 or array_length(v_entries,1) is null then
    if v_use_pack and v_use > 0 then
      update public.player_packs set qty = qty + v_use where username = v_uname and pack = p_pack;
    end if;
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);

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
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack)
        values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',true,p_pack);
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
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack)
        values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',false,p_pack);
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
$fn$;

-- ============================================================================
-- 6) VALIDATOR: stacks boleh bersumber dari roll_ledger juga
--    (syarat sebelum `ledger_enforce` pernah boleh diangkat ke 1)
-- ============================================================================
create or replace function public._validate_stacks_ledger(p_uname text, p_stacks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_enforce numeric := coalesce((select val from public.roll_config where key='ledger_enforce'), 0);
  v_out     jsonb := '[]'::jsonb;
  v_drop    jsonb := '[]'::jsonb;
  v_s       jsonb;
  v_key     text;
  v_ok      boolean;
begin
  if p_uname is null or p_stacks is null or jsonb_typeof(p_stacks) <> 'array' then
    return coalesce(p_stacks, '[]'::jsonb);
  end if;

  for v_s in select jsonb_array_elements(p_stacks) loop
    v_key := (v_s->>'char') || '|' ||
             coalesce(nullif(v_s->>'mut',''), 'none') || '|' ||
             case when coalesce(v_s->>'shiny','false') in ('true','1') then '1' else '0' end;
    select exists (
             select 1 from public.stacks_legacy l
              where l.username = p_uname and l.vkey = v_key
           ) or exists (
             select 1 from public.roll_history h
              where h.username = p_uname
                and h.card_id = (v_s->>'char')
                and h.mut = coalesce(nullif(v_s->>'mut',''),'none')
                and h.shiny = (case when coalesce(v_s->>'shiny','false') in ('true','1') then true else false end)
                and h.dup = false
           ) or exists (
             /* 0041: hasil bulk_roll tercatat AGREGAT di roll_ledger; baris dup=false
                adalah varian yang memang melahirkan stack baru di server. */
             select 1 from public.roll_ledger g
              where g.username = p_uname
                and g.card_id = (v_s->>'char')
                and g.mut = coalesce(nullif(v_s->>'mut',''),'none')
                and g.shiny = (case when coalesce(v_s->>'shiny','false') in ('true','1') then true else false end)
                and g.dup = false
           )
      into v_ok;
    if coalesce(v_ok, false) then
      v_out := v_out || jsonb_build_array(v_s);
    else
      v_drop := v_drop || jsonb_build_array(v_s);
    end if;
  end loop;

  if jsonb_array_length(v_drop) > 0 then
    /* Detail DIBATASI (20 contoh + jumlah): jalur instantRollFast (INTAN 100K, masih
       client-side di unit ini) menyuntik ratusan kartu tanpa riwayat -> tanpa batas,
       tamper_log membengkak oleh satu baris raksasa. */
    perform public._tamper(p_uname, 'STACK_UNLEDGERED', 'stacks',
      jsonb_array_length(p_stacks)::text, jsonb_array_length(v_out)::text,
      jsonb_build_object('enforce', v_enforce, 'droppedCount', jsonb_array_length(v_drop),
                         'droppedSample', (select coalesce(jsonb_agg(d), '[]'::jsonb)
                                             from (select d from jsonb_array_elements(v_drop) d limit 20) s)));
  end if;

  if coalesce(v_enforce, 0) <= 0 then
    return p_stacks;   -- shadow mode: jangan pernah buang kartu pemain
  end if;
  return v_out;
end;
$fn$;

-- ============================================================================
-- 7) ACL
-- ============================================================================
do $$
begin
  /* bulk_roll = jalur tulis pemain. */
  execute 'revoke all on function public.bulk_roll(text,integer,numeric) from public';
  execute 'revoke execute on function public.bulk_roll(text,integer,numeric) from anon';
  execute 'grant execute on function public.bulk_roll(text,integer,numeric) to authenticated';

  /* Helper: JANGAN pernah di-grant ke anon/authenticated. `_roll_entries` menerima
     save sebagai argumen bebas (baca data akun lain), dan `_binom_small`/`_bulk_count`
     cuma dipakai internal — sama seperti `_rebuild_packs` (0039) yang sengaja
     service_role saja. */
  execute 'revoke all on function public._roll_entries(jsonb,text,numeric) from public, anon, authenticated';
  execute 'revoke all on function public._binom_small(integer,numeric) from public, anon, authenticated';
  execute 'revoke all on function public._bulk_count(numeric,numeric) from public, anon, authenticated';

  execute 'revoke all on function public._validate_stacks_ledger(text,jsonb) from public';
  execute 'revoke execute on function public._validate_stacks_ledger(text,jsonb) from anon, authenticated';

  /* roll_pull signature-nya tidak berubah (0036 sudah revoke+grant yang sama);
     diulang di sini supaya ACL tetap benar kalau file ini dijalankan sendiri. */
  execute 'revoke all on function public.roll_pull(integer,text,numeric) from public';
  execute 'revoke execute on function public.roll_pull(integer,text,numeric) from anon';
  execute 'grant execute on function public.roll_pull(integer,text,numeric) to authenticated';
  execute 'drop function if exists public.roll_pull(integer,text)';
end $$;
