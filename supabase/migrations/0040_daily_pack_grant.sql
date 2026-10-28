-- 0040_daily_pack_grant.sql — Unit 5b-1: pack harian jadi grant SERVER, bonus
-- login client dihapus.
--
-- MENGAPA. `claimDaily()` (state.js:1193) memberi Instan Roll Pack 100K lewat
-- `addDailyR100kPacks()` yang cuma menulis `state.dailyR100kBalance` + localStorage
-- (`acb_daily_r100k_v1:<user>`). Angka itu SENGAJA tidak pernah masuk ke ledger:
-- jalur push memotongnya sebelum merge (`supabase-sync.js:94-108`) dan respons
-- merge menambahkannya lagi (supabase-sync.js:170-178, 552, 595). Efeknya polisi
-- pack 0029 buta terhadap sumber ini, jadi F12
--   setDailyR100kBalance(9999)
-- = 9999 pack x 100.000 tarikan, tanpa satu baris pun di `player_packs` dan tanpa
-- `PACK_INFLATE`. Ini lubang pack yang lebih besar dari pemakaian berlebih: tidak
-- ada yang memotongnya karena server tidak pernah melihatnya.
--
-- POLA. Ikuti `claim_daily_gem` (0023/0025) yang sudah benar: satu klaim per hari
-- UTC lewat kunci `daily:<date>` di `gem_claims`, siklus 7 hari dihitung server
-- dari jumlah klaim, dan saldo akhir dibalas ke client. Pack harian sekarang
-- dibayar di dalam RPC yang sama (satu klaim = gem + coin + pack, satu index
-- siklus, satu round trip) sehingga `day_index` client dan server tidak bisa
-- lari terpisah seperti sekarang.
--
-- Amnesty: saldo phantom yang sudah dipegang pemain dipindahkan sekali ke
-- `player_packs` (di-cap satu siklus penuh = 31, lebih dari itu tidak bisa
-- dipertanggungjawabkan dan dicatat ke tamper_log). Tabel
-- `daily_pack_amnesty` membuat blok itu aman dijalankan ulang.
--
-- Kolom `pack_def.pulls` dipakai Unit 5b-2 (`bulk_roll`): jumlah tarikan per pack
-- sampai sekarang HANYA ada di client (`PACK_ROLL_AMOUNT` panels.js:1819), jadi
-- server tidak punya cara tahu 1 pack r25k itu berapa pull.

-- 1) JUMLAH TARIKAN PER PACK (cermin PACK_ROLL_AMOUNT panels.js:1819)
alter table public.pack_def add column if not exists pulls integer;
update public.pack_def
   set pulls = case id
                 when 'r5k'   then 5000
                 when 'r10k'  then 10000
                 when 'r25k'  then 25000
                 when 'r50k'  then 50000
                 when 'r100k' then 100000
                 else 0 end;
alter table public.pack_def alter column pulls set default 0;
alter table public.pack_def alter column pulls set not null;

-- 2) PENANDA AMNESTI (biar migrasi ini bisa dijalankan ulang tanpa ganda)
create table if not exists public.daily_pack_amnesty (
  username   text primary key,
  packs      integer not null check (packs >= 0),
  claimed_in integer not null,
  at         timestamptz not null default now()
);
alter table public.daily_pack_amnesty enable row level security;
revoke all on public.daily_pack_amnesty from public, anon, authenticated;

do $$
declare
  v_rec record;
  v_raw integer;
  v_grant integer;
begin
  for v_rec in
    select s.username,
           public._int_of(coalesce(s.save_data,'{}'::jsonb), 'dailyR100kBalance', 0) as raw
      from public.player_saves s
     where public._int_of(coalesce(s.save_data,'{}'::jsonb), 'dailyR100kBalance', 0) > 0
       and not exists (select 1 from public.daily_pack_amnesty a where a.username = s.username)
  loop
    v_raw   := greatest(0, v_rec.raw);
    v_grant := least(31, v_raw);
    if v_grant > 0 then
      insert into public.player_packs (username, pack, qty)
      values (v_rec.username, 'r100k', v_grant)
      on conflict (username, pack) do update set qty = public.player_packs.qty + excluded.qty;
    end if;
    insert into public.daily_pack_amnesty (username, packs, claimed_in)
      values (v_rec.username, v_grant, v_raw);
    if v_raw > v_grant then
      perform public._tamper(v_rec.username, 'DAILY_PACK_CAP', 'dailyR100kBalance',
                             v_raw::text, v_grant::text,
                             jsonb_build_object('dropped', v_raw - v_grant));
    end if;
  end loop;
end;
$$;

-- 3) claim_daily_gem v2: siklus yang sama, sekarang juga membayar pack.
--    Salinan utuh versi 0023/0025 + baris grant pack (lihat §7 AGENTS.md: 0040
--    men-supersede fungsi ini, sama seperti 0036 men-supersede roll_pull).
create or replace function public.claim_daily_gem()
 returns jsonb
 language plpgsql
 security definer
 set search_path = public
as $fn$
declare
  c_cycle_gem  constant integer[] := array[10,15,20,25,30,40,60];
  c_cycle_coin constant bigint[]  := array[30000,50000,70000,100000,150000,200000,400000];
  c_cycle_pack constant integer[] := array[1,2,3,4,5,6,10];  /* = DAILY_PACKS_100K state.js:1059 */
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_n      integer;
  v_gems   integer;
  v_coins  bigint;
  v_packs  integer;
  v_key    text;
  v_ins    integer;
  v_bal    integer;
  v_cbal   bigint;
  v_pack_qty integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select count(*) into v_n
    from public.gem_claims
   where username = v_uname and action_key like 'daily:%';
  v_gems  := c_cycle_gem[(v_n % 7) + 1];
  v_coins := c_cycle_coin[(v_n % 7) + 1];
  v_packs := c_cycle_pack[(v_n % 7) + 1];

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

  /* 0040: pack masuk ledger, bukan angka save. `_rebuild_packs` akan membaca
     qty ini sebagai kebenaran, jadi klaim client berikutnya tidak perlu lagi
     "mengurangi bonus" supaya tidak dianggap inflasi. */
  insert into public.player_packs (username, pack, qty)
  values (v_uname, 'r100k', v_packs)
  on conflict (username, pack) do update set qty = public.player_packs.qty + excluded.qty;
  select coalesce(qty, 0) into v_pack_qty
    from public.player_packs where username = v_uname and pack = 'r100k';

  return jsonb_build_object('ok', true, 'gems', v_gems, 'balance', v_bal,
                            'coins', v_coins, 'coins_balance', v_cbal,
                            'packs', v_packs, 'pack_qty', v_pack_qty,
                            'day_index', (v_n % 7) + 1);
end;
$fn$;

-- 4) ACL. `create or replace` tidak menjamin grant tetap ada, dan grant untuk
--    fungsi ini memang harus authenticated-only (identitas dari JWT).
revoke all on function public.claim_daily_gem() from public, anon;
grant  execute on function public.claim_daily_gem() to authenticated, service_role;

-- 5) Verifikasi cepat: tidak ada pack yang boleh hilang/amnesti salah.
--    (dijalankan manual: node _tmp/probe_0040.cjs)
