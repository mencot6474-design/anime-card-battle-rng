-- 0055:hapus branch "konsumsi cermin" di _rebuild_packs.
-- Sejak 0041 (bulk_roll/roll_pull), 0049 (iklan), 0052 (tower/intan) SEMUA konsumsi
-- pack terjadi di server lewat RPC yang memotong player_packs langsung. Cermin
-- client yang LEBIH KECIL dari ledger bukan lagi konsumsi — itu push basi
-- (save() debounce 400ms bisa mengirim mirror lama setelah RPC grant commit).
-- Branch lama `update player_packs set qty = v_claim_qty` menghancurkan grant
-- yang baru masuk: bug "pack 100K daily tidak masuk backpack" (terbukti probe
-- _tmp/probe_daily_race.cjs: grant 6 -> push basi 5 -> ledger hancur -> PACK_INFLATE).
-- Sekarang: klaim < ledger = ledger tetap (server menang, cermin dikoreksi naik);
-- klaim > ledger = grant sampai allowance, sisanya PACK_INFLATE (tidak berubah).
-- Badan fungsi disalin verbatim dari live (pg_get_functiondef 2026-11-13),
-- satu-satunya perubahan = branch konsumsi dihapus. ACL tetap service_role saja.

create or replace function public._rebuild_packs(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    -- 0055: klaim lebih kecil dari ledger DIABAIKAN (ledger tetap) — konsumsi
    -- hanya sah lewat RPC server; mirror rendah = push basi, bukan pemakaian.
    if v_claim_qty > v_led then
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
  -- sebagai INTAN_INFLATE lalu DIPOTONG (tidak menghukum, hanya tidak membayar).
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
$function$;

revoke execute on function public._rebuild_packs(jsonb, text) from public, anon, authenticated;