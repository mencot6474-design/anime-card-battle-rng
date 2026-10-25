-- 0031_devtools_guard.sql — reset total saat DevTools terdeteksi
--
-- PERMINTAAN USER: "kalau hacker buka inspect/F12 → ada peringatan lalu save
-- dikembalikan ke awal semua."
--
-- PEMBAGIAN TUGAS (penting):
--   * DETEKSI ada di client (js/devtools-guard.js) — heuristik, TIDAK bisa
--     dipercaya sebagai batas keamanan. Client hanya melaporkan sinyal.
--   * HUKUMAN ada di server (RPC di bawah): server yang membangun ulang save ke
--     kondisi freshState, menghapus ledger item/pack & progres, dan mencatat
--     audit. Client tidak pernah mengirim save "kosong" sendiri, jadi F12 tidak
--     bisa dipakai untuk mereset akun orang lain (identitas = auth.uid()).
--
-- KONSEKUENSI YANG DISENGAJA (baca sebelum mengubah):
--   * Reset berlaku untuk akun yang login. Tamu (tanpa sesi Auth) hanya kena
--     reset lokal di client (localStorage) — tidak ada baris server.
--   * Deteksi bisa false positive (DevTools di-dock saat dev, zoom, extension
--     yang membaca console). Karena itu ada `guard_allow`: daftar akun yang
--     DIKECUALIKAN. Akun owner/developer WAJIB dimasukkan ke sini:
--       insert into public.guard_allow (username, note) values ('namamu','owner');
--   * Reset TIDAK menghapus baris player_saves / auth.users (username tetap),
--     jadi pemain bisa main lagi dari awal tanpa daftar ulang.
--   * `dev_guard` menyimpan riwayat hit. Kalau nanti mau melunakkan hukuman,
--     ubah ambangnya di sini (default: hit pertama = reset).
--
-- URUTAN DEPLOY: jalankan migration ini DULU, baru push client (client lama
-- tidak memanggil RPC ini, jadi aman).

-- ============================================================
-- 1) TABEL
-- ============================================================
create table if not exists public.guard_allow (
  username text        primary key,
  note     text        not null default '',
  added_at timestamptz not null default now()
);

create table if not exists public.dev_guard (
  username   text        primary key,
  hits       integer     not null default 0,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  reset_at   timestamptz,
  resets     integer     not null default 0,
  last_signal text       not null default ''
);

alter table public.guard_allow enable row level security;
alter table public.dev_guard   enable row level security;
revoke all on public.guard_allow from anon, authenticated;
revoke all on public.dev_guard   from anon, authenticated;

-- ============================================================
-- 2) HELPER: save kondisi awal (cermin freshState() js/state.js:12)
--    Kartu starter = STORY_BIBLE.units[0] (CH_UNSTOPPABLE_FIST) supaya pemain
--    masih bisa main tanpa roll dulu.
-- ============================================================
create or replace function public._fresh_save()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'coins', 1000,
    'premiumGems', 50,
    'wbTokens', 0,
    'infTokens', 0,
    'playerLv', 1,
    'xp', 0,
    'dailyIndex', 0,
    'lastClaim', '',
    'summons', 0,
    'totalRolls', 0,
    'playSec', 0,
    'muted', false,
    'diff', 'normal',
    'chap', 1,
    'raidDiff', 'normal',
    'raidCleared', jsonb_build_object('normal', false, 'hard', false,
                                      'extreme', false, 'nightmare', false),
    'raidShopOwned', '{}'::jsonb,
    'towerShopOwned', '{}'::jsonb,
    'storyGemMilestones', '{}'::jsonb,
    'dailyGemPending', 0,
    'storyCd', '{}'::jsonb,
    'rebirth', jsonb_build_object('count', 0, 'essence', 0),
    'tower', jsonb_build_object('best', 0, 'auto', false),
    'battleSpeed', 1,
    'cleared', '{}'::jsonb,
    'clearedDiff', jsonb_build_object('normal', '{}'::jsonb, 'hard', '{}'::jsonb,
                                      'extreme', '{}'::jsonb, 'nightmare', '{}'::jsonb),
    'equippedId', 'reset',
    'equippedId2', null,
    'deck', jsonb_build_array('reset', null, null, null),
    'stacks', jsonb_build_array(jsonb_build_object(
      'id', 'reset', 'char', 'CH_UNSTOPPABLE_FIST', 'tier', 'R', 'fav', false,
      'lock', false, 'mut', 'none', 'shiny', false, 'trait', 'none', 'count', 1)),
    'history', '[]'::jsonb,
    'battle', 'null'::jsonb,
    'player', jsonb_build_object('luckBase', 1, 'luckFlat', 0, 'luckPercent', 0,
                                 'exp', 0, 'lv', 1, 'sp', 0, 'tree', '{}'::jsonb),
    'weather', 'null'::jsonb,
    'weatherBest', 'null'::jsonb,
    'potions', 0,
    'mythicPotions', 0,
    'luckPots', jsonb_build_array(0, 0, 0),
    'speedPots', jsonb_build_array(0, 0, 0),
    'luckBuffs', '[]'::jsonb,
    'speedBuffs', '[]'::jsonb,
    'artOwned', '[]'::jsonb,
    'artSlots', jsonb_build_array(null, null),
    'petOwned', '[]'::jsonb,
    'petEquipped', 'null'::jsonb,
    'intanRolls', 0,
    'idxRewardsClaimed', 0,
    'rollPacks', jsonb_build_object('r5k', 0, 'r10k', 0, 'r25k', 0,
                                    'r50k', 0, 'r100k', 0));
$$;

-- ============================================================
-- 3) RPC: laporkan DevTools + reset total
--    p_signal = nama sinyal yang memicu ("size", "console", "debugger",
--    "manual"). Hanya untuk audit, tidak memengaruhi keputusan.
-- ============================================================
create or replace function public.report_devtools(p_signal text default 'unknown')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_hits    integer;
  v_signal  text := left(coalesce(nullif(p_signal, ''), 'unknown'), 40);
  v_at      timestamptz := now();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  -- Akun developer/owner: hanya dicatat, TIDAK direset.
  if exists (select 1 from public.guard_allow where username = v_uname) then
    return jsonb_build_object('ok', true, 'exempt', true, 'reset', false);
  end if;

  insert into public.dev_guard (username, hits, first_at, last_at, last_signal)
  values (v_uname, 1, v_at, v_at, v_signal)
  on conflict (username) do update
    set hits = public.dev_guard.hits + 1,
        last_at = v_at,
        last_signal = v_signal
  returning hits into v_hits;

  -- HUKUMAN: bangun ulang save dari nol.
  update public.player_saves
     set save_data = public._fresh_save(),
         updated_at = v_at,
         sp_legacy = 0
   where user_id = v_uid;

  -- Ledger & progres ikut dihapus: kalau tidak, item/pack/progres lama akan
  -- langsung "dipulihkan" oleh merge/klaim berikutnya.
  delete from public.player_items     where username = v_uname;
  delete from public.player_packs     where username = v_uname;
  delete from public.pack_allowance   where username = v_uname;
  delete from public.story_progress   where username = v_uname;
  delete from public.tower_progress   where username = v_uname;
  delete from public.leaderboard_scores where username = v_uname;
  delete from public.leaderboard_claims where username = v_uname;

  update public.dev_guard
     set reset_at = v_at, resets = resets + 1
   where username = v_uname;

  perform public._tamper(v_uname, 'DEVTOOLS_RESET', 'devtools',
                         v_signal, 'closed',
                         jsonb_build_object('hits', v_hits));

  return jsonb_build_object('ok', true, 'reset', true, 'hits', v_hits, 'at', v_at);
end;
$$;

-- ============================================================
-- 4) GRANT
-- ============================================================
do $$
begin
  -- RPC tulis: JWT-only.
  execute 'revoke all on function public.report_devtools(text) from public';
  execute 'revoke execute on function public.report_devtools(text) from anon';
  execute 'grant execute on function public.report_devtools(text) to authenticated';

  -- helper internal
  execute 'revoke all on function public._fresh_save() from public';
  execute 'revoke execute on function public._fresh_save() from anon, authenticated';
end $$;

select pg_notify('pgrst', 'reload schema');
