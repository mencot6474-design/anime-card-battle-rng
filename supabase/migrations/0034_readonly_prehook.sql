-- 0034_readonly_prehook.sql — jangan pernah menulis dari pre-request hook
--     di transaksi read-only (replica).
--
-- MASALAH (ditemukan 2026-10-29 saat melepas gerbang login CrazyGames):
--   Semua RPC authenticated balas `405 — cannot execute INSERT in a read-only
--   transaction` (SQLSTATE 25006). Akibatnya pemain tidak bisa memuat save
--   cloud, dan karena build CrazyGames menjadikan SEMUA orang guest, ini
--   melumpuhkan progres setiap akun.
--
-- AKAR:
--   `_rpc_pre_request` (0033) memasang rate-limiter yang `insert into rpc_rate`
--   untuk SETIAP RPC kecuali `guard_status`/`guard_nuke`. Namun fungsi seperti
--   `get_my_save`, `get_my_session_id`, `get_online_players_count` dideklarasikan
--   STABLE, sehingga PostgREST mengirim permintaannya ke REPLICA read-only.
--   Hook pre-request berjalan di transaksi yang sama, jadi INSERT-nya ditolak
--   25006 dan seluruh request gagal.
--   Komentar 0033 sebenarnya "rate limit RPC tulis" — tapi kodenya ikut
--   menyeret RPC baca.
--
-- FIX:
--   Baca status read-only via `current_setting('transaction_read_only')` dan
--   `pg_is_in_recovery()` di awal hook. Kalau TRUE (kita ada di replica
--   read-only), SKIP semua operasi TULIS: auto-nuke TTL, insert `rpc_rate` +
--   housekeeping delete, dan `_guard_strike`. Yang tetap jalan hanyalah
--   `raise 'GUARD_PENDING'` (hanya melempar error, tidak menulis), jadi akun
--   yang sedang dikunci tetap terblokir walau hanya membaca.
--
--   Efek: reader tetap di replica (tidak menambah beban primary — penting untuk
--   free tier), dan rate-limit tetap menegakkan RPC tulis di primary (tempat ia
--   memang seharusnya). Bot yang membanjiri RPC baca murah memang tidak
--   di-rate-limit lewat jalur ini, tapi itu bukan target 0033 (targetnya
--   faucet: gem/topup/spend).
--
-- Disk↔DB: fungsi ini REPLIKASI utuh `_rpc_pre_request` versi 0033 + guard,
--   supaya definisi di repo tetap sama dengan yang terpasang.

create or replace function public._rpc_pre_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h          jsonb;
  v_ua         text;
  v_origin     text;
  v_ref        text;
  v_method     text;
  v_path       text;
  v_fn         text;
  v_uid        uuid;
  v_uname      text;
  v_pending    boolean;
  v_pending_at timestamptz;
  v_cfg        public.guard_cfg;
  v_reason     text;
  v_hits       integer;
  v_ro         boolean := false;
begin
  begin
    v_h      := coalesce(current_setting('request.headers', true), '{}')::jsonb;
    v_method := upper(coalesce(current_setting('request.method', true), ''));
    v_path   := coalesce(current_setting('request.path', true), '');
    v_uid    := auth.uid();
  exception when others then
    return;
  end;

  if v_method <> 'POST' then return; end if;

  -- KUNCI FIX: request yang di-route ke transaksi read-only (STABLE RPC yang
  -- oleh Supabase/PostgREST dikirim ke REPLICA) tidak boleh menulis apa pun di
  -- sini. Deteksi sekali di awal, pakai untuk menggerbangi semua cabang bertulis
  -- di bawah. `pg_current_transaction_read_only()` TIDAK ada di Postgres ini,
  -- jadi pakai dua sinyal resmi: flag transaksi read-only + standby recovery.
  begin
    v_ro := (current_setting('transaction_read_only', true) = 'on')
            OR pg_is_in_recovery();
  exception when others then
    v_ro := false;
  end;

  v_ua     := lower(coalesce(v_h->>'user-agent', ''));
  v_origin := coalesce(v_h->>'origin', '');
  v_ref    := coalesce(v_h->>'referer', '');
  v_fn     := case when v_path like '%/rpc/%'
                   then regexp_replace(v_path, '^.*/rpc/', '')
                   else '' end;

  if v_uid is not null then
    select p.username, g.pending_nuke, g.pending_at
      into v_uname, v_pending, v_pending_at
      from public.player_saves p
      left join public.rpc_guard g on g.username = p.username
     where p.user_id = v_uid
     limit 1;

    /* --- kunci akun yang menunggu bom --- */
    if v_uname is not null
       and not exists (select 1 from public.guard_allow where username = v_uname)
       and v_pending then
      select * into v_cfg from public.guard_cfg where id = true;
      if v_pending_at is not null and v_pending_at < now() - v_cfg.pending_ttl
         and not v_ro then
        /* auto-nuke butuh menulis; skip di replica, jalan di request tulis
           berikutnya saat TTL-nya masih kedaluwarsa. */
        perform public._guard_nuke(v_uname, 'PENDING_TTL', jsonb_build_object('fn', v_fn));
      elsif v_fn not in ('guard_status', 'guard_nuke', 'report_devtools',
                         'link_player_auth', 'auth_whoami') then
        raise exception 'GUARD_PENDING' using
          errcode = 'PT403',
          hint    = 'save dikunci menunggu reset';
      end if;
    end if;

    /* --- rate limit RPC tulis (0033) — hanya di transaksi yang boleh menulis --- */
    if not v_ro
       and v_uname is not null and v_fn <> ''
       and v_fn not in ('guard_status', 'guard_nuke') then
      select * into v_cfg from public.guard_cfg where id = true;
      insert into public.rpc_rate as r (username, bucket, hits)
      values (v_uname, date_trunc('minute', now()), 1)
      on conflict (username, bucket) do update set hits = r.hits + 1
      returning hits into v_hits;

      if random() < 0.02 then
        delete from public.rpc_rate where bucket < now() - interval '10 minutes';
      end if;

      if v_hits > v_cfg.rpc_per_min then
        raise exception 'RATE_LIMITED' using
          errcode = 'PT429',
          hint    = 'terlalu banyak RPC tulis per menit';
      end if;
    end if;
  end if;

  /* --- fingerprint (heuristik, bisa dipalsukan) --- */
  if v_ua ~ '(curl|wget|python|httpie|postmanruntime|insomnia|node-fetch|axios|go-http-client|okhttp|java/|libwww|powershell|scrapy|headlesschrome)' then
    v_reason := 'TOOL_UA';
  elsif v_origin = '' and v_ref = ''
        and v_ua !~ '(mozilla|chrome|safari|firefox|edg/|opr/|capacitor|; wv\))' then
    v_reason := 'NO_ORIGIN';
  end if;

  -- _guard_strike menulis (rpc_guard / rpc_guard_anon) → skip di replica.
  if v_reason is not null and not v_ro then
    perform public._guard_strike(v_uname, v_fn, 'RPC_GUARD_' || v_reason,
      jsonb_build_object('ua', left(v_ua, 120), 'origin', left(v_origin, 120)));
  end if;
end;
$$;

revoke all on function public._rpc_pre_request() from public;
grant execute on function public._rpc_pre_request() to authenticator, anon, authenticated;

select pg_notify('pgrst', 'reload schema');
