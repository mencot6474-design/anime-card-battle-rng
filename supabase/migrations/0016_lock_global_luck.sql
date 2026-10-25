-- ===========================================================
-- KUNCI global_luck (anti-cheat, Opsi B)
-- Jalankan di Supabase SQL Editor (atau: npx supabase db push).
--
-- MASALAH: tabel global_luck punya policy longgar (allow insert/update/read
-- untuk {public}) dan client menulis LANGSUNG ke tabel lewat stackGlobalLuck
-- (POST/PATCH REST). Karena pembayaran gem (verifyAndDeductGems) adalah
-- panggilan TERPISAH dari penulis buff, siapa pun bisa curl-INSERT baris
-- global_luck (multiplier 100×, ends_at +10 jam) TANPA bayar → buff luck
-- server-wide gratis. Ini ngefek ke ekonomi roll (Opsi B = lindungi).
--
-- SOLUSI (pola sama dengan Unit 1 player_saves):
--   1. Read path TETAP via REST (getGlobalLuck butuh anon SELECT) → policy
--      SELECT-only + grant select.
--   2. Write path jadi RPC definer `buy_global_luck(username, password_hash)`
--      yang ATOMIK: potong gem + stack buff dalam SATU transaksi. Logika
--      stack (STEP 10, MAX 100, +1 jam, plafon now+10 jam) pindah ke server
--      supaya client tidak bisa ngatur multiplier/ends_at seenaknya.
--   3. Revokes INSERT/UPDATE/DELETE dari anon/authenticated → tabel tidak
--      bisa ditulis langsung lagi; cuma definer RPC yang bisa (bypass RLS).
--   4. Advisory lock serialisasi semua pembelian biar dua orang yang klik
--      barengan nggak bikin double-row / nembus max.
--
-- Setelah ini client `buyGlobalLuck` panggil SATU RPC (bukan deduct + stack
-- terpisah). `stackGlobalLuck`/`activateGlobalLuck` di client jadi mati →
-- ikut dihapus di supabase-sync.js.
-- ===========================================================

-- 1) buang SEMUA policy lama di global_luck (dibuat via dashboard, nama tak known)
do $$
declare r record;
begin
  for r in
    select polname from pg_policy
     where polrelid = 'public.global_luck'::regclass
  loop
    execute format('drop policy %I on public.global_luck', r.polname);
  end loop;
end $$;

-- 2) RLS: hanya SELECT untuk publik (read path), tulis lewat definer RPC
alter table public.global_luck enable row level security;

create policy global_luck_read on public.global_luck
  for select to anon, authenticated using (true);

-- 3) cabut hak tulis langsung, sisakan baca
revoke insert, update, delete, references, trigger
  on public.global_luck from anon, authenticated;
grant select on public.global_luck to anon, authenticated;

-- 4) RPC atomik: bayar gem + stack buff
create or replace function public.buy_global_luck(
  p_username      text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- konstanta server (kebenaran tunggal; client cuma display)
  c_cost   integer := 1200;          -- harga gem per aktivasi
  c_step   integer := 10;            -- +multiplier per stack
  c_max    integer := 100;           -- plafon multiplier
  c_step_ms interval := interval '1 hour';   -- +durasi per stack
  c_max_win interval := interval '10 hours'; -- ends_at tak boleh lewat now+10 jam

  uname     text := lower(coalesce(p_username, ''));
  stored_pw text;
  cur_gems  integer;
  merged    jsonb;

  g_id      bigint;
  g_mult    integer;
  g_end     timestamptz;
  g_act     timestamptz;
  new_mult  integer;
  new_end   timestamptz;
begin
  if uname = '' then
    raise exception 'BAD_INPUT';
  end if;

  -- serialisasi antar-pembelian
  perform pg_advisory_xact_lock(hashtext('global_luck'));

  -- baca + kunci baris player (auth + saldo gem)
  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0), password
    into cur_gems, stored_pw
    from public.player_saves
   where username = uname
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  -- baca + kunci baris buff aktif (ends_at > now)
  select id, multiplier, ends_at, activated_at
    into g_id, g_mult, g_end, g_act
    from public.global_luck
   where ends_at > now()
   order by ends_at desc
   limit 1
   for update;

  -- kalau sudah mentok max, jangan potong gem
  if g_id is not null and coalesce(g_mult, 0) >= c_max then
    return jsonb_build_object('ok', false, 'msg', 'SUDAH_MAX',
                              'multiplier', g_mult, 'ends_at', g_end);
  end if;

  -- saldo cukup?
  if cur_gems < c_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', cur_gems, 'cost', c_cost);
  end if;

  -- hitung buff baru (server-side)
  new_mult := least(coalesce(g_mult, 0) + c_step, c_max);
  if g_id is not null then
    new_end := least(g_end + c_step_ms, now() + c_max_win);
  else
    new_end := now() + c_step_ms;
  end if;

  -- potong gem di save_data (sama seperti spend_gems)
  merged := jsonb_set(coalesce((select save_data from public.player_saves
                                where username = uname), '{}'::jsonb),
                      '{premiumGems}', to_jsonb(cur_gems - c_cost), true);
  update public.player_saves
     set save_data = merged, updated_at = now()
   where username = uname;

  -- upsert buff
  if g_id is not null then
    update public.global_luck
       set multiplier = new_mult,
           ends_at    = new_end,
           activated_by = uname
     where id = g_id;
  else
    insert into public.global_luck (activated_by, activated_at, ends_at, multiplier)
    values (uname, now(), new_end, new_mult);
  end if;

  return jsonb_build_object(
    'ok', true,
    'balance', cur_gems - c_cost,
    'cost', c_cost,
    'multiplier', new_mult,
    'ends_at', new_end,
    'activated_by', uname
  );
end;
$$;

revoke all on function public.buy_global_luck(text, text) from public;
grant execute on function public.buy_global_luck(text, text) to anon, authenticated, service_role;

-- Smoke test (ganti USERNAME / HASH):
-- select public.buy_global_luck('USERNAME','HASH');           -- → ok + multiplier 10
-- select public.buy_global_luck('USERNAME','HASH');           -- → multiplier 20, saldo -1200
-- select public.get_leaderboard('inf_tower', null, 3, null);  -- kontrol RPC lain masih hidup
-- select * from public.global_luck where ends_at > now();
