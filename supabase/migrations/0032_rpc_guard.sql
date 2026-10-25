-- 0032_rpc_guard.sql — deteksi bot RPC (curl/Postman) + "bom" reset saat login
--
-- MASALAH: guard DevTools (0031) hanya melihat browser. Hacker yang memanggil
-- PostgREST langsung pakai JWT sendiri (curl/Postman/script) tidak terlihat
-- sama sekali. Migration ini menambah tiga lapis:
--
--   1) HONEYPOT (bukti keras). RPC umpan yang client asli TIDAK PERNAH memanggil
--      (`free_gems`, `admin_grant`, `dev_unlock_all`, `topup_free`). Grant-nya
--      sengaja dibuka ke anon+authenticated supaya kelihatan seperti endpoint
--      bocor. Siapa pun yang memanggilnya = bot. Tidak bisa dipalsukan, karena
--      yang dinilai bukan header melainkan fungsi yang tidak ada di bundle.
--   2) FINGERPRINT (heuristik). PostgREST pre-request hook membaca
--      `request.headers`: User-Agent tool (curl/python/postman/...) atau request
--      POST tanpa Origin/Referer = strike. Bisa dipalsukan (curl -H UA browser),
--      jadi default MODE = 'log' (hanya mencatat), bukan langsung menghukum.
--   3) BOM DI LOGIN. Saat pending_nuke=true, semua RPC tulis dikunci (403
--      GUARD_PENDING) kecuali `guard_status`/`guard_nuke`/`report_devtools`.
--      Client (`js/rpc-guard.js`) memanggil `guard_status` di enterGame, menampil-
--      kan hitung mundur 30 detik, lalu `guard_nuke` -> save dibangun ulang dari
--      `_fresh_save()` (0031) + ledger & progres dihapus. Kalau client tidak
--      pernah datang (curl terus), pending kedaluwarsa (default 24 jam) dan
--      `_rpc_pre_request` mengeksekusi nuke sendiri.
--
-- MODE:
--   guard_cfg.mode = 'log'      -> strike hanya dicatat (default, aman rilis)
--   guard_cfg.mode = 'enforce'  -> strike >= strike_limit memicu pending_nuke
--   guard_cfg.honeypot_enforce  -> honeypot SELALU memicu pending_nuke (default on)
--   Aktifkan enforce setelah `rpc_guard` + `rpc_guard_anon` diperiksa (lihat AGENTS).
--
-- ROLLBACK DARURAT (pre-request dimatikan, guard tetap ada tapi pasif):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
--
-- CATATAN: `_tmp/probe_*.cjs` memakai UA node -> akan kena strike saat mode
-- 'enforce'. Selama 'log' aman; akun owner tetap dikecualikan lewat `guard_allow`.
--
-- URUTAN DEPLOY: jalankan migration ini DULU (mode 'log'), baru push client.

-- ============================================================
-- 1) TABEL
-- ============================================================
create table if not exists public.guard_cfg (
  id               boolean  primary key default true check (id),
  mode             text     not null default 'log' check (mode in ('log', 'enforce')),
  strike_limit     integer  not null default 3,
  honeypot_enforce boolean  not null default true,
  pending_ttl      interval not null default interval '24 hours',
  updated_at       timestamptz not null default now()
);
insert into public.guard_cfg (id) values (true) on conflict (id) do nothing;

create table if not exists public.rpc_guard (
  username       text        primary key,
  strikes        integer     not null default 0,
  pending_nuke   boolean     not null default false,
  pending_reason text        not null default '',
  pending_at     timestamptz,
  last_fn        text        not null default '',
  last_ua        text        not null default '',
  last_origin    text        not null default '',
  last_at        timestamptz,
  nukes          integer     not null default 0,
  nuked_at       timestamptz,
  first_at       timestamptz not null default now()
);

-- Request tanpa identitas (anon) tidak bisa dihukum; simpan jejaknya saja.
create table if not exists public.rpc_guard_anon (
  id     bigserial   primary key,
  at     timestamptz not null default now(),
  reason text        not null default '',
  fn     text        not null default '',
  ua     text        not null default '',
  origin text        not null default ''
);

alter table public.guard_cfg       enable row level security;
alter table public.rpc_guard       enable row level security;
alter table public.rpc_guard_anon  enable row level security;
revoke all on public.guard_cfg      from anon, authenticated;
revoke all on public.rpc_guard      from anon, authenticated;
revoke all on public.rpc_guard_anon from anon, authenticated;

-- ============================================================
-- 2) HELPER
-- ============================================================
create or replace function public._guard_cfg()
returns public.guard_cfg
language sql
stable
security definer
set search_path = public
as $$
  select * from public.guard_cfg where id = true;
$$;

-- Catat strike. p_uname null = request anon (hanya dicatat, tidak bisa dihukum).
-- Balasan: jumlah strike terbaru, -1 kalau akun ada di guard_allow, 0 kalau anon.
create or replace function public._guard_strike(
  p_uname  text,
  p_fn     text,
  p_reason text,
  p_detail jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg  public.guard_cfg;
  v_hits integer;
  v_at   timestamptz := now();
begin
  if p_uname is null or p_uname = '' then
    insert into public.rpc_guard_anon (reason, fn, ua, origin)
    values (left(coalesce(p_reason, ''), 40), left(coalesce(p_fn, ''), 60),
            left(coalesce(p_detail->>'ua', ''), 160),
            left(coalesce(p_detail->>'origin', ''), 160));
    return 0;
  end if;

  if exists (select 1 from public.guard_allow where username = p_uname) then
    return -1;
  end if;

  insert into public.rpc_guard as g (username, strikes, last_fn, last_ua, last_origin, last_at)
  values (p_uname, 1, left(coalesce(p_fn, ''), 60),
          left(coalesce(p_detail->>'ua', ''), 160),
          left(coalesce(p_detail->>'origin', ''), 160), v_at)
  on conflict (username) do update
    set strikes     = g.strikes + 1,
        last_fn     = excluded.last_fn,
        last_ua     = excluded.last_ua,
        last_origin = excluded.last_origin,
        last_at     = excluded.last_at
  returning strikes into v_hits;

  -- Honeypot = pelanggaran pasti -> masuk tamper_log (audit + toast client).
  -- Strike fingerprint TIDAK ditulis ke tamper_log: merge_player_state membalas
  -- semua baris tamper_log transaksi itu sebagai `tamper[]`, jadi mencatatnya
  -- akan memunculkan toast "PELANGGARAN TERDETEKSI" ke pemain jujur yang
  -- kena false positive di mode 'log'. Jejaknya cukup di rpc_guard.
  if p_reason = 'HONEYPOT' then
    perform public._tamper(p_uname, 'HONEYPOT', 'rpc',
                           left(coalesce(p_fn, ''), 60), '',
                           coalesce(p_detail, '{}'::jsonb));
  end if;

  select * into v_cfg from public.guard_cfg where id = true;
  if v_cfg.mode = 'enforce' and v_hits >= v_cfg.strike_limit then
    update public.rpc_guard
       set pending_nuke   = true,
           pending_reason = coalesce(nullif(pending_reason, ''), p_reason),
           pending_at     = coalesce(pending_at, v_at)
     where username = p_uname;
  end if;

  return v_hits;
end;
$$;

-- Hukuman: bangun ulang save dari nol (cermin report_devtools 0031).
create or replace function public._guard_nuke(
  p_uname  text,
  p_reason text,
  p_detail jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := now();
begin
  if p_uname is null or p_uname = '' then return false; end if;

  update public.player_saves
     set save_data  = public._fresh_save(),
         updated_at = v_at,
         sp_legacy  = 0
   where username = p_uname;

  -- Ledger & progres ikut dihapus: kalau tidak, item/pack/progres lama akan
  -- langsung "dipulihkan" oleh merge/klaim berikutnya.
  delete from public.player_items       where username = p_uname;
  delete from public.player_packs       where username = p_uname;
  delete from public.pack_allowance     where username = p_uname;
  delete from public.story_progress     where username = p_uname;
  delete from public.tower_progress     where username = p_uname;
  delete from public.leaderboard_scores where username = p_uname;
  delete from public.leaderboard_claims where username = p_uname;

  update public.rpc_guard
     set pending_nuke   = false,
         pending_reason = '',
         pending_at     = null,
         strikes        = 0,
         nukes          = nukes + 1,
         nuked_at       = v_at
   where username = p_uname;

  perform public._tamper(p_uname, 'RPC_GUARD_RESET', 'rpc',
                         left(coalesce(p_reason, ''), 60), '',
                         coalesce(p_detail, '{}'::jsonb));
  return true;
end;
$$;

-- Dipanggil oleh RPC umpan. Tidak pernah mengembalikan "berhasil".
create or replace function public._guard_honeypot(
  p_fn     text,
  p_detail jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_cfg   public.guard_cfg;
begin
  if v_uid is not null then
    select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  end if;

  if v_uname is not null
     and exists (select 1 from public.guard_allow where username = v_uname) then
    return;
  end if;

  perform public._guard_strike(v_uname, p_fn, 'HONEYPOT', coalesce(p_detail, '{}'::jsonb));

  if v_uname is not null then
    select * into v_cfg from public.guard_cfg where id = true;
    if v_cfg.honeypot_enforce then
      update public.rpc_guard
         set pending_nuke   = true,
             pending_reason = coalesce(nullif(pending_reason, ''), 'HONEYPOT'),
             pending_at     = coalesce(pending_at, now()),
             strikes        = greatest(strikes, 100)
       where username = v_uname;
    end if;
  end if;
end;
$$;

-- ============================================================
-- 3) PRE-REQUEST HOOK (dipasang di role authenticator)
--    Dibuat SANGAT defensif: error apa pun = return, jangan pernah mematikan
--    seluruh API. Hanya POST yang diperiksa; GET (baca) dilewatkan.
-- ============================================================
create or replace function public._rpc_pre_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h              jsonb;
  v_ua             text;
  v_origin         text;
  v_ref            text;
  v_method         text;
  v_path           text;
  v_fn             text;
  v_uid            uuid;
  v_uname          text;
  v_pending        boolean;
  v_pending_at     timestamptz;
  v_cfg            public.guard_cfg;
  v_reason         text;
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

  v_ua     := lower(coalesce(v_h->>'user-agent', ''));
  v_origin := coalesce(v_h->>'origin', '');
  v_ref    := coalesce(v_h->>'referer', '');
  v_fn     := case when v_path like '%/rpc/%'
                   then regexp_replace(v_path, '^.*/rpc/', '')
                   else '' end;

  /* --- kunci akun yang menunggu bom --- */
  if v_uid is not null then
    select p.username, g.pending_nuke, g.pending_at
      into v_uname, v_pending, v_pending_at
      from public.player_saves p
      left join public.rpc_guard g on g.username = p.username
     where p.user_id = v_uid
     limit 1;

    if v_uname is not null
       and not exists (select 1 from public.guard_allow where username = v_uname)
       and v_pending then
      select * into v_cfg from public.guard_cfg where id = true;
      if v_pending_at is not null and v_pending_at < now() - v_cfg.pending_ttl then
        perform public._guard_nuke(v_uname, 'PENDING_TTL', jsonb_build_object('fn', v_fn));
      elsif v_fn not in ('guard_status', 'guard_nuke', 'report_devtools',
                         'link_player_auth', 'auth_whoami') then
        raise exception 'GUARD_PENDING' using
          errcode = 'PT403',
          hint    = 'save dikunci menunggu reset';
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

  if v_reason is not null then
    perform public._guard_strike(v_uname, v_fn, 'RPC_GUARD_' || v_reason,
      jsonb_build_object('ua', left(v_ua, 120), 'origin', left(v_origin, 120)));
  end if;
end;
$$;

-- ============================================================
-- 4) RPC CLIENT (JWT-only)
-- ============================================================
create or replace function public.guard_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_row   public.rpc_guard;
  v_cfg   public.guard_cfg;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  select * into v_cfg from public.guard_cfg where id = true;
  select * into v_row from public.rpc_guard where username = v_uname;

  if not found then
    return jsonb_build_object('ok', true, 'pending', false, 'strikes', 0,
                              'mode', v_cfg.mode,
                              'exempt', exists(select 1 from public.guard_allow
                                                where username = v_uname));
  end if;

  return jsonb_build_object(
    'ok', true,
    'pending', v_row.pending_nuke,
    'reason', v_row.pending_reason,
    'at', v_row.pending_at,
    'strikes', v_row.strikes,
    'nukes', v_row.nukes,
    'mode', v_cfg.mode,
    'exempt', exists(select 1 from public.guard_allow where username = v_uname));
end;
$$;

create or replace function public.guard_nuke(p_signal text default 'login')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_row   public.rpc_guard;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  if exists (select 1 from public.guard_allow where username = v_uname) then
    return jsonb_build_object('ok', true, 'exempt', true, 'reset', false);
  end if;

  select * into v_row from public.rpc_guard where username = v_uname;
  if not found or not v_row.pending_nuke then
    return jsonb_build_object('ok', false, 'msg', 'NO_PENDING');
  end if;

  perform public._guard_nuke(
    v_uname,
    'CLIENT_' || left(coalesce(p_signal, 'login'), 40),
    jsonb_build_object('strikes', v_row.strikes, 'reason', v_row.pending_reason));

  return jsonb_build_object('ok', true, 'reset', true,
                            'reason', v_row.pending_reason, 'strikes', v_row.strikes);
end;
$$;

-- ============================================================
-- 5) HONEYPOT (sengaja terbuka untuk anon + authenticated)
-- ============================================================
create or replace function public.free_gems(p_amount integer default 999999)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._guard_honeypot('free_gems', jsonb_build_object('amount', p_amount));
  return jsonb_build_object('ok', false, 'msg', 'NOT_AVAILABLE');
end;
$$;

create or replace function public.admin_grant(p_coins bigint default 1000000000)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._guard_honeypot('admin_grant', jsonb_build_object('coins', p_coins));
  return jsonb_build_object('ok', false, 'msg', 'NOT_AVAILABLE');
end;
$$;

create or replace function public.dev_unlock_all()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._guard_honeypot('dev_unlock_all', '{}'::jsonb);
  return jsonb_build_object('ok', false, 'msg', 'NOT_AVAILABLE');
end;
$$;

create or replace function public.topup_free(p_gems integer default 50000)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._guard_honeypot('topup_free', jsonb_build_object('gems', p_gems));
  return jsonb_build_object('ok', false, 'msg', 'NOT_AVAILABLE');
end;
$$;

-- ============================================================
-- 6) GRANT
-- ============================================================
do $$
begin
  -- helper internal: tidak boleh dipanggil client
  execute 'revoke all on function public._guard_cfg() from public';
  execute 'revoke execute on function public._guard_cfg() from anon, authenticated';
  execute 'revoke all on function public._guard_strike(text,text,text,jsonb) from public';
  execute 'revoke execute on function public._guard_strike(text,text,text,jsonb) from anon, authenticated';
  execute 'revoke all on function public._guard_nuke(text,text,jsonb) from public';
  execute 'revoke execute on function public._guard_nuke(text,text,jsonb) from anon, authenticated';
  execute 'revoke all on function public._guard_honeypot(text,jsonb) from public';
  execute 'revoke execute on function public._guard_honeypot(text,jsonb) from anon, authenticated';

  -- RPC client: JWT-only
  execute 'revoke all on function public.guard_status() from public';
  execute 'revoke execute on function public.guard_status() from anon';
  execute 'grant execute on function public.guard_status() to authenticated';
  execute 'revoke all on function public.guard_nuke(text) from public';
  execute 'revoke execute on function public.guard_nuke(text) from anon';
  execute 'grant execute on function public.guard_nuke(text) to authenticated';

  -- pre-request: dipanggil PostgREST (authenticator) sebelum SET ROLE
  execute 'revoke all on function public._rpc_pre_request() from public';
  execute 'grant execute on function public._rpc_pre_request() to authenticator, anon, authenticated';

  -- honeypot: dibuka sengaja
  execute 'revoke all on function public.free_gems(integer) from public';
  execute 'grant execute on function public.free_gems(integer) to anon, authenticated';
  execute 'revoke all on function public.admin_grant(bigint) from public';
  execute 'grant execute on function public.admin_grant(bigint) to anon, authenticated';
  execute 'revoke all on function public.dev_unlock_all() from public';
  execute 'grant execute on function public.dev_unlock_all() to anon, authenticated';
  execute 'revoke all on function public.topup_free(integer) from public';
  execute 'grant execute on function public.topup_free(integer) to anon, authenticated';
end $$;

-- ============================================================
-- 7) PASANG PRE-REQUEST
-- ============================================================
alter role authenticator set pgrst.db_pre_request = 'public._rpc_pre_request';
select pg_notify('pgrst', 'reload config');
select pg_notify('pgrst', 'reload schema');
