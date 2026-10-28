-- ============================================================================
-- 0042 — claim_index_reward: KLAIM REWARD INDEX jadi kejadian server (Unit 5b-3)
-- ============================================================================
-- LUBANG. `claimIndexReward` (panels.js:712) menambah `state.rollPacks.r5k` di
-- browser langsung dari progress koleksi varian (15 varian unik = +1 pack).
-- Server tidak mengenal sumber ini: `_pack_allowance_for('r5k')` (0029) cuma
-- menghitung tower_rate × token_daily, jadi saat merge, mirror hasil klaim
-- dianggap inflasi oleh `_rebuild_packs` (0029) dan di-nol-kan. Buktinya nyata
-- di `tamper_log` reason `PACK_INFLATE` (baris pack r5k) — pemain jujur yang
-- menekan tombol KLAIM kehilangan pack-nya satu sync kemudian.
--
-- Ini BUKAN lubang curang: server tetap menang, cermin F12 di-cap oleh allowance
-- yang cuma kenal tower. Yang bocor = pemain jujur, bukan cheat. 5b-3 memindahkan
-- kebenaran ke sisi server supaya tombol KLAIM dibayar di ledger dan tidak bisa
-- hilang oleh merge.
--
-- SUMBER KEBENARAN progress (F12 tidak bisa nambahi varian palsu tanpa nulis
-- `roll_history`, yang hanya terjadi lewat RPC `roll_pull`/`bulk_roll`):
--   a) `stacks_legacy` (0036) — vkey saat migrasi 0036 jalan
--   b) `stacks_legacy_5b3` (baru, di bawah) — snapshot save_data.stacks sekali
--      saat 0042 apply, supaya kartu yang masuk lewat jalur client-only (tower
--      roll masih `instantRoll`, reward iklan masih client) antara 0036→0042
--      tetap terhitung. Ini amnesty, bukan percobaan mempercayai cermin.
--   c) `roll_history` (0036/0041) dengan `dup = false` — setiap varian yang
--      pernah DILAHIRKAN server, termasuk semua hasil RPC 0041 bulk_roll.
-- Milestone = `roll_config.idx_milestone` default 15; tuning cukup ubah nilai di
-- DB tanpa mengirim build klien baru (pola sama dengan `bulk_max_packs` 0041).
--
-- DESIGN. Satu RPC `claim_index_reward()` (authenticated-only, pola 0040
-- `claim_daily_gem`). Server hitung blocks, potong gain dari `blocks_claimed`
-- per username (tabel baru `index_reward_claims`), tulis selisih ke
-- `player_packs.r5k`, balas `gain` + saldo final. Klien pakai angka respons,
-- bukan `+=` lokal.
--
-- AMNESTI. Pemain yang sudah pernah menekan KLAIM sebelum upgrade punya
-- `save_data->>'idxRewardsClaimed'` (angka cermin) dan saldo `player_packs.r5k`
-- hasil 0029 backfill. Kita SEED `index_reward_claims.blocks_claimed` dengan
-- `LEAST(klaim_client, blocks_server)`: yang jujur tidak kehilangan yang sudah
-- mereka klaim (blocks_server sudah termasuk kartu amnesty b/c di atas), yang
-- F12 tidak dapat grant baru dari server.
--
-- BELUM DITUTUP DI SINI (sengaja): reward iklan (`pack100k`, `gems`) masih
-- client-mint + cooldown localStorage (0043), tower roll masih `instantRoll`
-- (0044+). Setelah 0042, kartu yang lahir lewat jalur itu TIDAK menambah
-- progress index sampai RPC-nya jadi server juga — gap itu disengaja dan sudah
-- dicatat di AGENTS.md §7.

-- ============================================================================
-- 1) KONSTANTA
-- ============================================================================
insert into public.roll_config (key, val) values ('idx_milestone', '15')
on conflict (key) do nothing;

-- ============================================================================
-- 2) SNAPSHOT AMNESTI (satu kali, supaya kartu pra-5b3 terhitung)
-- ============================================================================
create table if not exists public.stacks_legacy_5b3 (
  username text not null,
  vkey     text not null,
  primary key (username, vkey)
);
do $$
begin
  execute 'alter table public.stacks_legacy_5b3 enable row level security';
  execute 'revoke all on table public.stacks_legacy_5b3 from public, anon, authenticated';
end $$;

insert into public.stacks_legacy_5b3 (username, vkey)
select s.username,
       (o->>'char') || '|' ||
       coalesce(nullif(o->>'mut',''), 'none') || '|' ||
       case when coalesce(o->>'shiny','false') in ('true','1') then '1' else '0' end
  from public.player_saves s
  cross join jsonb_array_elements(coalesce(s.save_data->'stacks','[]'::jsonb)) o
 on conflict (username, vkey) do nothing;

-- ============================================================================
-- 3) LEDGER PROGRES INDEX (blocks_claimed per pemain)
-- ============================================================================
create table if not exists public.index_reward_claims (
  username       text primary key,
  blocks_claimed integer not null default 0 check (blocks_claimed >= 0),
  updated_at     timestamptz not null default now()
);
do $$
begin
  execute 'alter table public.index_reward_claims enable row level security';
  execute 'revoke all on table public.index_reward_claims from public, anon, authenticated';
end $$;

-- ============================================================================
-- 4) HELPER: hitung owned variants dari 3 sumber (stacks_legacy + snapshot
--    0042 + roll_history dup=false). Service-role only: argumennya bebas, kalau
--    di-grant ke authenticated jadi bocor informasi pemain lain — sama seperti
--    `_validate_stacks_ledger` (0036) dan `_roll_entries` (0041).
-- ============================================================================
create or replace function public._owned_variant_count(p_uname text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct vkey)::integer from (
    select vkey from public.stacks_legacy        where username = p_uname
    union
    select vkey from public.stacks_legacy_5b3    where username = p_uname
    union
    select h.card_id || '|' ||
           coalesce(nullif(h.mut,''), 'none') || '|' ||
           case when h.shiny then '1' else '0' end
      from public.roll_history h
     where h.username = p_uname and h.dup = false
  ) s;
$$;

do $$ begin
  execute 'revoke all on function public._owned_variant_count(text) from public, anon, authenticated';
  execute 'grant execute on function public._owned_variant_count(text) to service_role';
end $$;

-- ============================================================================
-- 5) SEED blocks_claimed = LEAST(klaim client, blocks server) untuk pemain yang
--    punya save pra-0042. Yang belum pernah klaim = 0, jadi bisa langsung RPC
--    dan dapat semua blocks yang accumulated.
-- ============================================================================
do $$
declare v_rec record; v_client integer; v_srv_blocks integer; v_seed integer;
begin
  for v_rec in select s.username,
                     coalesce(nullif(s.save_data->>'idxRewardsClaimed','')::integer, 0) as client_val
                from public.player_saves s
               where not exists (select 1 from public.index_reward_claims c where c.username = s.username)
  loop
    v_client     := greatest(0, v_rec.client_val);
    v_srv_blocks := floor(public._owned_variant_count(v_rec.username)::numeric
                           / coalesce((select val::numeric from public.roll_config where key='idx_milestone'), 15))::integer;
    v_seed       := least(v_client, v_srv_blocks);
    insert into public.index_reward_claims (username, blocks_claimed)
      values (v_rec.username, v_seed)
      on conflict (username) do nothing;
  end loop;
end $$;

-- ============================================================================
-- 6) RPC claim_index_reward — tombol KLAIM di footer Index.
--    Return: ok | gain | owned | blocks | claimed | milestone | rollPacks (mirror)
--    Error path: AUTH_REQUIRED, PLAYER_NOT_FOUND, NOTHING_TO_CLAIM.
--    Idempoten — panggilan ganda langsung setelah klaim sukses = NOTHING_TO_CLAIM
--    karena blocks_claimed sudah dinaikkan ke blocks. Tidak ada cooldown (gain
--    dihitung dari server ledger, F12 tidak bisa mempercepat owned).
-- ============================================================================
create or replace function public.claim_index_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid       uuid := auth.uid();
  v_uname     text;
  v_milestone integer;
  v_owned     integer;
  v_blocks    integer;
  v_claimed   integer;
  v_gain      integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  v_milestone := coalesce((select val::integer from public.roll_config where key='idx_milestone'), 15);
  if v_milestone is null or v_milestone <= 0 then v_milestone := 15; end if;

  v_owned  := public._owned_variant_count(v_uname);
  v_blocks := floor(v_owned::numeric / v_milestone)::integer;

  -- Lock row klaim supaya dua RPC paralel tidak dobel-grant. Insert-on-null
  -- menjamin baris selalu ada walau pemain belum pernah ke-seed.
  insert into public.index_reward_claims (username, blocks_claimed)
    values (v_uname, 0)
    on conflict (username) do nothing;
  select blocks_claimed into v_claimed
    from public.index_reward_claims where username = v_uname for update;
  v_claimed := coalesce(v_claimed, 0);

  v_gain := v_blocks - v_claimed;
  if v_gain <= 0 then
    return jsonb_build_object(
      'ok', false, 'msg', 'NOTHING_TO_CLAIM',
      'owned', v_owned, 'blocks', v_blocks, 'claimed', v_claimed,
      'milestone', v_milestone,
      'rollPacks', public._packs_of(v_uname));
  end if;

  update public.index_reward_claims
     set blocks_claimed = v_blocks, updated_at = now()
   where username = v_uname;

  insert into public.player_packs (username, pack, qty)
    values (v_uname, 'r5k', v_gain)
    on conflict (username, pack) do update
      set qty = public.player_packs.qty + excluded.qty;

  return jsonb_build_object(
    'ok', true, 'gain', v_gain,
    'owned', v_owned, 'blocks', v_blocks,
    'milestone', v_milestone,
    'rollPacks', public._packs_of(v_uname));
end;
$fn$;

-- ============================================================================
-- 7) ACL. `create or replace` tidak menjamin grant tetap ada, jadi diulang eksplisit.
-- ============================================================================
revoke all on function public.claim_index_reward() from public, anon;
grant  execute on function public.claim_index_reward() to authenticated, service_role;

-- ============================================================================
-- 8) Verifikasi: jalankan `node _tmp/probe_0042.cjs`. Kalau hijau, deploy:
--      $Supabase Management API apply migration (atau `npx supabase db push`).
--    Harness-nya ROLLBACK-only; tidak ada state uji yang masuk DB.
-- ============================================================================
