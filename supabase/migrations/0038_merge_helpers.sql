-- 0038_merge_helpers.sql — Unit 4d: lapisan helper yang belum pernah ditulis.
--
-- MENGAPA MIGRASI INI ADA
-- merge_player_state versi 0036/0037 membaca saldo lewat helper berbasis username
-- (get_player_gems, _tokens_of, _level_of, ...) dan menulis ke public.player_progress.
-- Tidak SATU PUN dari objek itu pernah dibuat — di repo pun definisinya tidak ada.
-- Akibatnya sejak 0037 dipasang (2026-10-27) setiap push save pemain balas 404
-- "function public.get_player_gems(text) does not exist": cloud sync MATI untuk
-- semua akun (player_saves.updated_at berhenti 2026-10-27, kecuali roll_pull yang
-- menulis save_data langsung tanpa lewat merge).
--
-- ATURAN PERBAIKAN: murni ADITIF. Tidak ada fungsi/tabel yang diubah atau di-drop,
-- supaya tidak ada lagi peluang menimpa perilaku yang sedang jalan.
--
-- SUMBER KEBENARAN: sama seperti merge versi 0029 (terbukti jalan bertahun-tahun di
-- produksi) — saldo diambil dari baris save pemain sendiri, BUKAN dari kolom mirror.
--.public.player_progress di sini cuma CERMIN untuk admin/dashboard; `_level_of`/`_xp_of`
-- tetap baca save_data supaya satu nilai tidak punya dua tuan.
--
-- KEAMANAN: semua reader dibatasi `user_id = auth.uid()`, jadi pemain lain tidak bisa
-- dipakai untuk mengintip saldo lewat panggilan RPC langsung.

-- ============================================================
-- 1) PEMBACA BERDASARKAN USERNAME (dipanggil merge_player_state)
-- ============================================================

create or replace function public.get_player_gems(p_uname text)
returns integer language sql stable security definer set search_path = public, auth as $$
  /* Cermin 0029: coalesce(nullif(save_data->>'premiumGems','')::integer, 0) */
  select coalesce(nullif(p.save_data->>'premiumGems','')::integer, 0)
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._coins_of(p_uname text)
returns bigint language sql stable security definer set search_path = public, auth as $$
  /* overload text dari _coins_of(jsonb) (0025) — default freshState = 1000 */
  select case
           when coalesce(p.save_data->>'coins','') ~ '^[0-9]{1,15}$' then (p.save_data->>'coins')::bigint
           else 1000::bigint
         end
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._tokens_of(p_uname text, p_kind text)
returns integer language sql stable security definer set search_path = public, auth as $$
  /* sama dengan _token_of(save_data, ...) tapi lewat username */
  select public._token_of(p.save_data,
                          case when p_kind = 'inf' then 'infTokens' else 'wbTokens' end)
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._level_of(p_uname text)
returns integer language sql stable security definer set search_path = public, auth as $$
  select greatest(1, public._int_of(p.save_data, 'playerLv', 1))
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._xp_of(p_uname text)
returns bigint language sql stable security definer set search_path = public, auth as $$
  select greatest(0, public._int_of(p.save_data, 'xp', 0)::bigint)
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._sp_legacy_of(p_uname text)
returns integer language sql stable security definer set search_path = public, auth as $$
  select coalesce(p.sp_legacy, 0)
    from public.player_saves p
   where p.username = p_uname and p.user_id = auth.uid()
$$;

create or replace function public._rebirth_today_of(p_uname text)
returns bigint language sql stable security definer set search_path = public, auth as $$
  select coalesce(sum(r.gained), 0)::bigint
    from public.rebirth_daily r
    join public.player_saves p on p.username = r.username
   where r.username = p_uname
     and r.day = (now() at time zone 'utc')::date
     and p.user_id = auth.uid()
$$;

-- ============================================================
-- 2) PEMBACA DARI SAVE (argumennya jsonb, tidak perlu DB)
--    Nama field mengikuti klien: player.luckBase/luckFlat/luckPercent +
--    rebirth.count/rebirth.essence. `luckPct`/`rebirthCount` yang ditulis
--    merge 0037 TIDAK dibaca klien, jadi kedua nama diterima di sini.
-- ============================================================

create or replace function public._bigint_of(p jsonb, k text, d bigint)
returns bigint language sql immutable as $$
  select case when coalesce(p->>k,'') ~ '^-?[0-9]{1,18}$' then (p->>k)::bigint else d end
$$;

create or replace function public._lb_of(p jsonb)
returns numeric language sql immutable as $$
  /* freshState: player.luckBase = 1 */
  select coalesce(nullif(p->'player'->>'luckBase','')::numeric, 1)
$$;

create or replace function public._lf_of(p jsonb)
returns numeric language sql immutable as $$
  select coalesce(nullif(p->'player'->>'luckFlat','')::numeric, 0)
$$;

create or replace function public._lp_of(p jsonb)
returns numeric language sql immutable as $$
  select coalesce(nullif(p->'player'->>'luckPercent','')::numeric,
                  nullif(p->'player'->>'luckPct','')::numeric, 0)
$$;

create or replace function public._sp_available_of(p jsonb)
returns integer language sql immutable as $$
  select coalesce(nullif(p->'player'->>'sp','')::integer, 0)
$$;

create or replace function public._rebirth_count_of(p jsonb)
returns integer language sql immutable as $$
  select coalesce(nullif(p->'rebirth'->>'count','')::integer,
                  nullif(p->'player'->>'rebirthCount','')::integer, 0)
$$;

create or replace function public._rebirth_gained_of(p jsonb)
returns bigint language sql immutable as $$
  select coalesce(nullif(p->'rebirth'->>'essence','')::numeric,
                  nullif(p->'player'->>'rebirthGained','')::numeric, 0)::bigint
$$;

create or replace function public._sp_spent_in(p_tree jsonb)
returns integer language sql stable as $$
  /* 0027 sudah mengunci biaya pohon skill lewat tree_node — dipakai apa adanya. */
  select coalesce(public._tree_cost(p_tree), 0)::integer
$$;

create or replace function public._xp_req(p_lv integer)
returns bigint language sql immutable as $$
  /* cermin klien (js/state.js: xpNeed = lv*1000), sama dengan merge 0026/0029 */
  select greatest(1, p_lv)::bigint * 1000::bigint
$$;

-- ============================================================
-- 3) DEBIT BERDASARKAN USERNAME
--    merge sudah menulis saldo final di akhir, jadi pemanggilan ini bukan
--    pengurang kedua: nilai yang ditulis spend_* langsung tertimpa save_data
--    hasil merge (keduanya menghasilkan angka yang sama).
-- ============================================================

create or replace function public.spend_coins(p_uname text, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_save jsonb; v_bal bigint; v_pay bigint;
begin
  select save_data into v_save from public.player_saves
   where username = p_uname and user_id = auth.uid() for update;
  if v_save is null then return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND'); end if;
  v_bal := greatest(0, coalesce(public._bigint_of(v_save, 'coins', 0), 0));
  v_pay := greatest(0, least(coalesce(p_amount, 0), v_bal));
  update public.player_saves
     set save_data = jsonb_set(v_save, '{coins}', to_jsonb(v_bal - v_pay), true)
   where username = p_uname and user_id = auth.uid();
  return jsonb_build_object('ok', true, 'coins', v_bal - v_pay, 'paid', v_pay);
end;
$$;

create or replace function public.spend_gems(p_uname text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_save jsonb; v_bal integer; v_pay integer;
begin
  select save_data into v_save from public.player_saves
   where username = p_uname and user_id = auth.uid() for update;
  if v_save is null then return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND'); end if;
  v_bal := greatest(0, coalesce(nullif(v_save->>'premiumGems','')::integer, 0));
  v_pay := greatest(0, least(coalesce(p_amount, 0), v_bal));
  update public.player_saves
     set save_data = jsonb_set(v_save, '{premiumGems}', to_jsonb(v_bal - v_pay), true)
   where username = p_uname and user_id = auth.uid();
  return jsonb_build_object('ok', true, 'premiumGems', v_bal - v_pay, 'paid', v_pay);
end;
$$;

-- ============================================================
-- 4) CERMIN player_progress (referensi yang tinggal di body merge 0037)
-- ============================================================

create table if not exists public.player_progress (
  username   text primary key,
  lv         integer  not null default 1,
  xp         bigint   not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.player_progress enable row level security;

-- isi sekali dari save yang ada supaya cermin tidak kosong
insert into public.player_progress (username, lv, xp)
select p.username,
       coalesce(nullif(p.save_data->>'playerLv','')::integer, 1),
       coalesce(nullif(p.save_data->>'xp','')::numeric, 0)::bigint
  from public.player_saves p
on conflict (username) do nothing;

-- ============================================================
-- 5) ACL — SAMAKAN DENGAN POLA 0033/0036: anon tidak boleh Execute.
--    Helper ini dipanggil merge (security definer, owner postgres), jadi
--    klien tidak butuh hak akses sendiri; tetapi tetap diberikan ke
--    authenticated supaya panggilan langsung (read-only, diri sendiri) mungkin.
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.get_player_gems(text)',
    'public._coins_of(text)',
    'public._tokens_of(text,text)',
    'public._level_of(text)',
    'public._xp_of(text)',
    'public._sp_legacy_of(text)',
    'public._rebirth_today_of(text)',
    'public._bigint_of(jsonb,text,bigint)',
    'public._lb_of(jsonb)',
    'public._lf_of(jsonb)',
    'public._lp_of(jsonb)',
    'public._sp_available_of(jsonb)',
    'public._rebirth_count_of(jsonb)',
    'public._rebirth_gained_of(jsonb)',
    'public._sp_spent_in(jsonb)',
    'public._xp_req(integer)',
    'public.spend_coins(text,bigint)',
    'public.spend_gems(text,integer)'
  ] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated, service_role';
  end loop;
  execute 'revoke all on table public.player_progress from anon, authenticated';
  execute 'grant select on table public.player_progress to service_role';
end;
$$;
