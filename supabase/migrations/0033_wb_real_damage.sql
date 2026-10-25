-- 0033_wb_real_damage.sql — damage World Boss = damage kartu asli + hardening lanjutan
--
-- PERMINTAAN USER: "dmg yang 100 di WB kembalikan ke dmg asli card aja biar
-- gak ada celah, sekalian kerjakan yang lainnya."
--
-- 1) WB TANPA SKALA ×100
--    Dulu client mengalikan damage kartu dengan RAID_DMG_SCALE=100 supaya masuk
--    skala pool 1T, dan server meniru angka itu di _wb_dmg_cap. Sekarang damage
--    yang dikirim = damage kartu apa adanya; pool, plafon, dan data lama ikut
--    dibagi 100 sehingga keseimbangan (jumlah run untuk menumbangkan boss)
--    TIDAK berubah, tapi tidak ada lagi "angka karangan" di antara kartu dan
--    pool yang bisa dipakai untuk menggeser batas.
--      pool 1e12 -> 1e10, cap atk×100×10×80 -> atk×10×80 (floor 1e7 -> 1e5)
--      attempts.dmg / runs.best_dmg / leaderboard world_boss* / days.hp_* ÷100
--    world_boss_bracket() TIDAK punya ambang damage (semua rank dapat
--    participant), jadi tidak ada ambang yang perlu diubah.
--
-- 2) deck_power DIHITUNG SERVER (Unit 5 parsial)
--    `_deck_power(save)` mencerminkan totalPower() client (deck × cardStats)
--    memakai card_stat + pengali mutasi/shiny/trait yang sama dengan
--    _wb_dmg_cap. submit_leaderboard_score mengabaikan angka client untuk
--    papan ini; selisih >10% dicatat LB_INFLATE.
--    Catatan jujur: isi `stacks` masih dari client, jadi ini menutup "kirim
--    angka bebas", bukan "kartu hasil injeksi" (itu Unit 4 / roll di server).
--
-- 3) RATE LIMIT RPC tulis per akun (`guard_cfg.rpc_per_min`, default 120/menit).
--    Berlaku untuk POST /rest/v1/rpc/* dari akun login; guard_status/guard_nuke
--    dikecualikan supaya bom tetap bisa dieksekusi.
--
-- 4) RETENSI `rpc_guard_anon` (request tanpa JWT tidak bisa dihukum, jadi
--    jejaknya dibatasi 7 hari) + pembersihan `rpc_rate` > 10 menit.
--
-- 5) guard_cfg.mode = 'enforce' (strike_limit 3). Rollback: update ... 'log'.

-- ============================================================
-- 1) POOL & PLAFON DAMAGE
-- ============================================================
create or replace function public.world_boss_pool_size()
returns bigint
language sql
immutable
as $$
  select 10000000000::bigint;
$$;

revoke all on function public.world_boss_pool_size() from public;
grant execute on function public.world_boss_pool_size() to anon, authenticated, service_role;

-- Plafon damage satu run, dihitung dari kartu terkuat di save server.
-- 10 = RAID_TURNS, 80 = kelonggaran crit/purple/ranton/everyNth/statGrow.
-- Tanpa ×100: damage yang dikirim client = damage kartu asli.
create or replace function public._wb_dmg_cap(p_save jsonb)
returns bigint
language sql
stable
as $$
  with scored as (
    select coalesce(max(
             cs.base_atk
             * case coalesce(nullif(s->>'mut',''),'none')
                 when 'gold' then 10 when 'rainbow' then 25
                 when 'secret' then 50 when 'ultima' then 100 else 1 end
             * case when (s->>'shiny') in ('true','1') then 5 else 1 end
             * case coalesce(nullif(s->>'trait',''),'none')
                 when 'common' then 1.10 when 'rare' then 1.10
                 when 'legendary' then 1.25 when 'superior' then 1.50
                 when 'transiden' then 2.00 when 'demigod' then 3.00
                 when 'cosmic' then 3.50 when 'bigbang' then 5.00 else 1 end
           ), 0) as atk
    from jsonb_array_elements(
           case when jsonb_typeof(p_save->'stacks') = 'array' then p_save->'stacks' else '[]'::jsonb end) s
    join public.card_stat cs on cs.char_id = s->>'char'
  )
  select greatest(100000::bigint, ceil(coalesce(atk, 0) * 10 * 80)::bigint)
  from scored;
$$;

revoke all on function public._wb_dmg_cap(jsonb) from public;
revoke execute on function public._wb_dmg_cap(jsonb) from anon, authenticated;

-- ============================================================
-- 2) MIGRASI DATA LAMA (sekali jalan)
-- ============================================================
create table if not exists public.migration_flags (
  name       text primary key,
  applied_at timestamptz not null default now()
);
alter table public.migration_flags enable row level security;
revoke all on public.migration_flags from anon, authenticated;

do $$
begin
  if not exists (select 1 from public.migration_flags where name = '0033_wb_rescale') then
    update public.world_boss_attempts
       set dmg = round(coalesce(dmg, 0) / 100.0)
     where coalesce(dmg, 0) > 0;

    update public.world_boss_runs
       set best_dmg = round(coalesce(best_dmg, 0) / 100.0)
     where coalesce(best_dmg, 0) > 0;

    update public.world_boss_days
       set hp_pool = round(hp_pool / 100.0),
           hp_left = round(hp_left / 100.0);

    update public.leaderboard_scores
       set value = round(value / 100.0)
     where board in ('world_boss', 'world_boss_b');

    insert into public.migration_flags (name) values ('0033_wb_rescale');
  end if;
end $$;

-- Samakan pool + sisa HP semua hari dengan skala baru (sumber: attempts yang
-- sudah submit, pola yang sama dengan world_boss_day_info).
update public.world_boss_days d
   set hp_pool = public.world_boss_pool_size(),
       hp_left = greatest(0, public.world_boss_pool_size() - coalesce((
         select sum(coalesce(a.dmg, 0))
           from public.world_boss_attempts a
          where a.day = d.day and a.boss_id = d.boss_id and a.submitted_at is not null
       ), 0));

-- ============================================================
-- 3) deck_power SERVER-SIDE
--    Cermin totalPower()/cardStats() js/cards-fx.js:291-297:
--      hp  = round(base_hp  * mutMult * shinyMult * TRAIT_HP[trait])
--      atk = round(base_atk * mutMult * shinyMult * TRAIT_ATK[trait])
--    deck[] berisi id stack; kartu yang tidak ada di stacks tidak dihitung.
-- ============================================================
create or replace function public._deck_power(p_save jsonb)
returns numeric
language sql
stable
as $$
  with deck as (
    select jsonb_array_elements_text(
             case when jsonb_typeof(p_save->'deck') = 'array'
                  then p_save->'deck' else '[]'::jsonb end) as sid
  ),
  cards as (
    select s as st,
           cs.base_atk, cs.base_hp,
           case coalesce(nullif(s->>'mut',''),'none')
             when 'gold' then 10 when 'rainbow' then 25
             when 'secret' then 50 when 'ultima' then 100 else 1 end::numeric as mm,
           case when (s->>'shiny') in ('true','1') then 5 else 1 end::numeric as sm,
           case coalesce(nullif(s->>'trait',''),'none')
             when 'common' then 1.10 when 'rare' then 1.10
             when 'legendary' then 1.25 when 'superior' then 1.50
             when 'transiden' then 2.00 when 'demigod' then 3.00
             when 'cosmic' then 3.50 when 'bigbang' then 5.00 else 1 end::numeric as ta,
           case coalesce(nullif(s->>'trait',''),'none')
             when 'rare' then 1.10 when 'superior' then 1.25
             when 'transiden' then 1.50 when 'demigod' then 1.50
             when 'cosmic' then 3.50 when 'bigbang' then 4.00 else 1 end::numeric as th
      from jsonb_array_elements(
             case when jsonb_typeof(p_save->'stacks') = 'array'
                  then p_save->'stacks' else '[]'::jsonb end) s
      join public.card_stat cs on cs.char_id = s->>'char'
     where s->>'id' in (select sid from deck where sid is not null)
  )
  select coalesce(sum(
           round(base_hp  * mm * sm * th)
         + round(base_atk * mm * sm * ta)
         ), 0)
    from cards;
$$;

revoke all on function public._deck_power(jsonb) from public;
revoke execute on function public._deck_power(jsonb) from anon, authenticated;

-- submit_leaderboard_score: papan deck_power memakai angka server.
create or replace function public.submit_leaderboard_score(
  p_board text,
  p_value numeric,
  p_meta  jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  uname     text;
  brd       text := p_board;
  per       text := public.lb_period(false);
  req       numeric;
  meta      jsonb := coalesce(p_meta, '{}'::jsonb);

  c_abs       numeric;
  c_step_mul  numeric;
  c_step_add  numeric;
  c_first     numeric;
  c_daily_max integer := 500;

  save      jsonb;
  srv       numeric;
  old_val  numeric;
  old_day  text;
  old_cnt  integer;
  eff      numeric;
  day_key  text := ((now() at time zone 'utc')::date)::text;
  new_cnt  integer;
  row_value numeric;
  row_at    timestamptz;
  my_rank   integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if brd is null or brd not in ('inf_tower', 'deck_power', 'rarest_pull') then
    raise exception 'BAD_BOARD';
  end if;
  if jsonb_typeof(meta) <> 'object' or pg_column_size(meta) > 2048 then
    meta := '{}'::jsonb;
  end if;
  req := greatest(0, least(coalesce(p_value, 0), 1e21::numeric));

  select username, save_data into uname, save
    from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  if brd = 'inf_tower' then
    c_abs := 9999;          c_step_mul := 1;    c_step_add := 200; c_first := 50;
  elsif brd = 'deck_power' then
    c_abs := 200000000;     c_step_mul := 10;   c_step_add := 0;   c_first := 100000;
  else -- rarest_pull
    c_abs := 50000000000000000000;  c_step_mul := 1000; c_step_add := 0;
    c_first := 1000000000000000;
  end if;

  /* deck_power = hitung ulang dari save server (0033). p_value hanya dipakai
     sebagai pembanding audit; angka yang disimpan selalu angka server. */
  if brd = 'deck_power' then
    srv := public._deck_power(coalesce(save, '{}'::jsonb));
    if req > srv * 1.10 then
      perform public._tamper(uname, 'LB_INFLATE', brd, req::text, srv::text);
    end if;
    req := srv;
  end if;

  if req > c_abs then
    perform public._tamper(uname, 'LB_INFLATE', brd, req::text, c_abs::text);
    return jsonb_build_object('ok', false, 'msg', 'LB_INFLATE', 'max', c_abs);
  end if;

  select value, inc_day, inc_count into old_val, old_day, old_cnt
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  if old_val is not null and old_val >= req then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank);
  end if;

  eff := least(req, c_abs);
  if old_val is null then
    eff := least(eff, c_first);
  else
    eff := least(eff, old_val * c_step_mul + c_step_add);
  end if;

  if old_day is distinct from day_key then
    old_cnt := 0;
  end if;

  if eff > coalesce(old_val, 0)
     and old_val is not null
     and coalesce(old_cnt, 0) >= c_daily_max then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank, 'capped', 'daily');
  end if;

  new_cnt := coalesce(old_cnt, 0)
             + case when eff > coalesce(old_val, 0) then 1 else 0 end;

  insert into public.leaderboard_scores
    (period, board, username, value, meta, updated_at, inc_day, inc_count)
  values (per, brd, uname, eff, meta, now(), day_key, new_cnt)
  on conflict (period, board, username) do update
    set value = excluded.value,
        meta = excluded.meta,
        updated_at = now(),
        inc_day = excluded.inc_day,
        inc_count = excluded.inc_count
    where public.leaderboard_scores.value < excluded.value;

  select value, updated_at into row_value, row_at
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  my_rank := public.lb_rank(per, brd, row_value, row_at);

  return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                            'value', row_value, 'rank', my_rank);
end;
$$;

-- ============================================================
-- 4) RATE LIMIT + RETENSI
-- ============================================================
alter table public.guard_cfg add column if not exists rpc_per_min integer not null default 120;
alter table public.guard_cfg add column if not exists anon_retention_days integer not null default 7;

create table if not exists public.rpc_rate (
  username text        not null,
  bucket   timestamptz not null,
  hits     integer     not null default 0,
  primary key (username, bucket)
);
alter table public.rpc_rate enable row level security;
revoke all on public.rpc_rate from anon, authenticated;

-- ============================================================
-- 5) PRE-REQUEST: rate limit + retensi anon
-- ============================================================
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
    /* Retensi: request anon tidak bisa dihukum, jadi jejaknya dibatasi. */
    if random() < 0.05 then
      delete from public.rpc_guard_anon
       where at < now() - (coalesce((select anon_retention_days from public.guard_cfg where id), 7)
                           || ' days')::interval;
    end if;
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

  /* Honeypot = pelanggaran pasti -> masuk tamper_log (audit + toast client).
     Strike fingerprint TIDAK ditulis ke tamper_log: merge_player_state membalas
     semua baris tamper_log transaksi itu sebagai `tamper[]`, jadi mencatatnya
     akan memunculkan toast "PELANGGARAN TERDETEKSI" ke pemain jujur yang
     kena false positive di mode 'log'. Jejaknya cukup di rpc_guard. */
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

revoke all on function public._guard_strike(text, text, text, jsonb) from public;
revoke execute on function public._guard_strike(text, text, text, jsonb) from anon, authenticated;

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
      if v_pending_at is not null and v_pending_at < now() - v_cfg.pending_ttl then
        perform public._guard_nuke(v_uname, 'PENDING_TTL', jsonb_build_object('fn', v_fn));
      elsif v_fn not in ('guard_status', 'guard_nuke', 'report_devtools',
                         'link_player_auth', 'auth_whoami') then
        raise exception 'GUARD_PENDING' using
          errcode = 'PT403',
          hint    = 'save dikunci menunggu reset';
      end if;
    end if;

    /* --- rate limit RPC tulis (0033) --- */
    if v_uname is not null and v_fn <> ''
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
        /* CATATAN: jangan panggil _guard_strike di sini. Raise di pre-request
           membatalkan seluruh transaksi request, jadi strike-nya ikut ter-rollback.
           Efeknya tetap tegas: request ke-121 dalam satu menit DITOLAK dan
           penghitungnya tidak bertambah, sehingga bot mentok di plafon itu. */
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

  if v_reason is not null then
    perform public._guard_strike(v_uname, v_fn, 'RPC_GUARD_' || v_reason,
      jsonb_build_object('ua', left(v_ua, 120), 'origin', left(v_origin, 120)));
  end if;
end;
$$;

revoke all on function public._rpc_pre_request() from public;
grant execute on function public._rpc_pre_request() to authenticator, anon, authenticated;

-- ============================================================
-- 6) AKTIFKAN ENFORCE
--    Honeypot sudah menghukum sejak 0032. Sekarang strike fingerprint juga
--    memicu bom (ambang 3 strike). Kembalikan ke 'log' kalau ada false positive:
--      update public.guard_cfg set mode = 'log';
-- ============================================================
update public.guard_cfg set mode = 'enforce', strike_limit = 3, updated_at = now() where id = true;

select pg_notify('pgrst', 'reload schema');
