-- 0039_intan_ledger.sql — Unit 5a: INTAN ROLL 100K jadi kredit server.
--
-- MENGAPA. Probe rollback (`node _tmp/probe_hole.cjs cg_user1`) membuktikan semua
-- field ekonomi lain sudah dipotong merge (coins 1e9+31rb -> 31rb, gems -> 60,
-- rollPacks 999999 -> 0 lewat _rebuild_packs, potions/luckPots -> plafon 200,
-- cleared dipangkas ke frontier, art/pet disaring ledger player_items) — TAPI
-- `intanRolls` lolos apa adanya: claim 999999 keluar 999999. Satu intan = 100.000
-- tarikan, dan jalurnya (instantRollFast) masih RNG client, jadi F12
-- `state.intanRolls = 1e9` = mencetak kartu langka tanpa batas + menaikkan
-- rarest_pull/totalRolls. Tidak ada jalur grant yang sah di client saat ini
-- (satu-satunya tulisan ke field itu adalah pengurangannya di panels.js:1936),
-- jadi nilai di atas kredit server tidak pernah bisa datang dari gameplay.
--
-- POLA. Sama seperti `sp_legacy` (0027): kolom server + amnesty sekali untuk save
-- lama, lalu merge menulis balik nilai server sehingga angka client tidak dipercaya.
-- Konsumsi lewat RPC, bukan lewat push save — kalau penurunan client diterima apa
-- ada, pemain bisa memakai kredit yang sama berulang kali (pakai -> push angka
-- kecil -> merge menulis balik angka besar).
--
-- Cermin client: 100.000 tarikan per intan ada di js/panels.js:1741
-- (`bpPackRollAmount=(kind==='intan')?100000`). Nilai itu disimpan di
-- roll_config('intan_pulls') supaya Unit 5b (bulk_roll di server) punya sumber
-- yang sama; kalau angka client berubah, update baris itu juga.

-- 1) KREDIT SERVER
alter table public.player_saves add column if not exists intan_credit integer not null default 0;
alter table public.player_saves drop constraint if exists player_saves_intan_credit_check;
alter table public.player_saves add constraint player_saves_intan_credit_check check (intan_credit >= 0);

-- Amnesty sekali untuk save lama: apa yang sudah mereka pegang di-akui, tapi
-- di-cap 5 (angka yang mustahil datang dari gameplay; save yang benar-benar
-- punya banyak tetap dapat jatah besarnya, sisanya hilang tanpa dihukum).
-- Kondisinya `intan_credit = 0` supaya migrasi ini aman dijalankan ulang.
update public.player_saves
   set intan_credit = least(5, (save_data->>'intanRolls')::integer)
 where intan_credit = 0
   and coalesce(save_data->>'intanRolls','') ~ '^[1-9][0-9]{0,8}$';

insert into public.roll_config (key, val) values ('intan_pulls', '100000')
on conflict (key) do nothing;

-- 2) merge menulis balik kredit server. Ditambah di DALAM _rebuild_packs (helper
--    yang memang sudah dipanggil merge_player_state), jadi merge tidak perlu
--    dirakit ulang dan tidak berisiko mengulang regresi helper seperti 0037.
create or replace function public._rebuild_packs(p_merged jsonb, p_uname text)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public
as $fn$
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
  v_intan_led integer;
  v_intan_claim integer;
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

  p_merged := jsonb_set(p_merged, '{rollPacks}', v_out, true);

  -- 0039: intan = kredit server, bukan angka save. Kenaikan di atas kredit dicatat
  -- sebagai INTAN_INFLATE lalu DIPOTONG (tidak dihukum, hanya tidak dibayar).
  -- Penurunan dari client TIDAK dipakai: konsumsi tercatat lewat spend_intan().
  select coalesce(intan_credit, 0) into v_intan_led
    from public.player_saves where username = p_uname;
  v_intan_led := coalesce(v_intan_led, 0);
  v_intan_claim := case when coalesce(p_merged->>'intanRolls', '') ~ '^[0-9]{1,9}$'
                        then (p_merged->>'intanRolls')::integer else 0 end;

  if v_intan_claim > v_intan_led then
    perform public._tamper(p_uname, 'INTAN_INFLATE', 'intanRolls',
                           v_intan_claim::text, v_intan_led::text,
                           jsonb_build_object('excess', v_intan_claim - v_intan_led));
  end if;

  return jsonb_set(p_merged, '{intanRolls}', to_jsonb(v_intan_led), true);
end;
$fn$;

-- 3) RPC konsumsi. Satu-satunya cara intan berkurang.
create or replace function public.spend_intan(p_qty integer default 1)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_credit integer;
  v_use    integer;
  v_pulls  bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;

  select username, intan_credit into v_uname, v_credit
    from public.player_saves
   where user_id = v_uid
     for update;

  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  v_credit := coalesce(v_credit, 0);
  v_use    := least(greatest(1, coalesce(p_qty, 1)), v_credit);
  if v_use <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'NO_INTAN', 'credit', 0);
  end if;

  v_pulls := v_use::bigint * coalesce((select val from public.roll_config where key='intan_pulls'), '100000')::bigint;

  update public.player_saves
     set intan_credit = intan_credit - v_use
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'spent', v_use, 'credit', v_credit - v_use,
                            'pulls', v_pulls);
end;
$fn$;

-- 4) ACL. Fungsi baru di schema public default-nya bisa dieksekusi anon, jadi
--    ditutup eksplisit. JANGAN grant `_rebuild_packs` ke authenticated: argumen
--    p_uname bebas + security definer = pemain bisa menulis player_packs milik
--    akun lain. Fungsi itu hanya dipanggil merge_player_state, yang jalan sebagai
--    owner dan tidak butuh EXECUTE dari peran anon/authenticated.
revoke all on function public._rebuild_packs(jsonb, text) from public, anon, authenticated;
grant  execute on function public._rebuild_packs(jsonb, text) to service_role;
revoke all on function public.spend_intan(integer) from public, anon;
grant  execute on function public.spend_intan(integer) to authenticated, service_role;
