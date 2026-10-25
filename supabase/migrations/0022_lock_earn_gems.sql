-- ============================================================
-- 0022_lock_earn_gems.sql  —  TUTUP KERAN GEM GRATIS
--
-- MASALAH: `earn_gems(p_username, p_password_hash, p_gems, p_save_data)`
-- menerima NOMINAL dari client dan "autentikasinya" cuma password hash —
-- hash itu justru tersimpan mentah di localStorage (`aab-users`). Siapa pun
-- yang buka F12 bisa memanggil RPC ini dengan p_gems = 999999 dan mencetak
-- gem tanpa batas (bypass topup, bukan sekadar cheat progres).
--
-- SOLUSI:
--   1. Username diambil dari `auth.uid()` (JWT), bukan dari parameter.
--      Grant execute dicabut dari anon -> hanya sesi login yang bisa.
--   2. Nominal per panggilan dibatasi (c_per_call).
--   3. Kuota harian per akun disimpan di tabel `gem_grants` dan diperiksa
--      ATOMIK lewat `on conflict ... where`, jadi dua request barengan tidak
--      bisa menembus plafon.
--   4. `p_save_data` DIHAPUS dari signature. RPC ini sekarang hanya menambah
--      premiumGems pada save yang tersimpan; client tidak bisa lagi menulis
--      field save lain lewat jalur ini.
--
-- ANGKA PLAFON (knob di bawah): disetel dari faucet legit yang ada sekarang.
--   - per panggilan 250 : reward terbesar = stage story (maks puluhan) /
--                         tukar token 20 / daily 60. 250 = margin besar.
--   - harian 3000       : replay story (35% gem, cooldown 5 menit/stage)
--                         memang dirancang jadi faucet; pemain rajin masih
--                         masuk, tapi tidak bisa cetak 1 juta sekali klik.
--   - 400 panggilan/hari: guard tambahan untuk spam panggilan kecil.
--   Kalau ekonomi berubah dan pemain legit mulai kena, NAIKKAN angkanya di
--   sini — jangan hapus plafonnya.
--
-- URUTAN DEPLOY: jalankan file ini DULU, baru push client baru.
--   (Client baru memanggil earn_gems(p_gems) yang belum ada sebelum migrasi.)
-- ============================================================
begin;

-- 1) Ledger kuota harian. RLS aktif + nol grant = tidak bisa dibaca client.
create table if not exists public.gem_grants (
  username   text        not null,
  day        date        not null default ((now() at time zone 'utc')::date),
  total      integer     not null default 0,
  calls      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (username, day)
);

alter table public.gem_grants enable row level security;
revoke all on public.gem_grants from anon, authenticated;

-- 2) Buang signature lama (yang menerima username + password hash dari client).
drop function if exists public.earn_gems(text, text, integer, jsonb);

-- 3) RPC baru: identitas dari JWT, nominal dibatasi, kuota atomik.
create or replace function public.earn_gems(p_gems integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_per_call constant integer := 250;
  c_daily    constant integer := 3000;
  c_calls    constant integer := 400;

  v_uid    uuid := auth.uid();
  v_uname  text;
  v_total  integer;
  v_calls  integer;
  v_bal    integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;
  if p_gems is null or p_gems <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  if p_gems > c_per_call then
    return jsonb_build_object('ok', false, 'msg', 'CAP_PER_CALL', 'max', c_per_call);
  end if;

  select username into v_uname
    from public.player_saves
   where user_id = v_uid
   limit 1;

  if v_uname is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  -- Kuota: satu statement, jadi aman dari request paralel.
  insert into public.gem_grants (username, day, total, calls)
  values (v_uname, (now() at time zone 'utc')::date, p_gems, 1)
  on conflict (username, day) do update
     set total      = public.gem_grants.total + excluded.total,
         calls      = public.gem_grants.calls + 1,
         updated_at = now()
   where public.gem_grants.total + excluded.total <= c_daily
     and public.gem_grants.calls + 1            <= c_calls
  returning total, calls into v_total, v_calls;

  if v_total is null then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP',
                              'cap', c_daily, 'calls', c_calls);
  end if;

  update public.player_saves
     set save_data = jsonb_set(
           coalesce(save_data, '{}'::jsonb),
           '{premiumGems}',
           to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer, 0) + p_gems),
           true),
         updated_at = now()
   where user_id = v_uid
   returning coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into v_bal;

  return jsonb_build_object('ok', true, 'balance', v_bal,
                            'today', v_total, 'cap', c_daily);
end;
$$;

revoke all on function public.earn_gems(integer) from public;
grant execute on function public.earn_gems(integer) to authenticated;

commit;

-- ============================================================
-- VERIFIKASI
--   -- 1) signature lama harus hilang, yang ada cuma earn_gems(integer):
--   select p.proname, pg_get_function_arguments(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'earn_gems';
--
--   -- 2) anon TIDAK boleh bisa eksekusi (harus 401 / 42501):
--   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
--     "$SUPABASE_URL/rest/v1/rpc/earn_gems" -H "apikey: $ANON" \
--     -H "Content-Type: application/json" -d '{"p_gems":999999}'
--
--   -- 3) tabel ledger tidak boleh kebaca anon (harus 401):
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "$SUPABASE_URL/rest/v1/gem_grants?select=*" -H "apikey: $ANON"
--
--   -- 4) pemakaian harian (buat cek pemain legit kena cap atau tidak):
--   select * from public.gem_grants order by updated_at desc limit 20;
-- ============================================================
