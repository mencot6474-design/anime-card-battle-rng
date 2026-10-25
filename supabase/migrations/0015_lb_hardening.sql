-- ===========================================================
-- LEADERBOARD HARDENING (anti-cheat, Opsi B) — papan mingguan:
--   inf_tower / deck_power / rarest_pull
-- Jalankan di Supabase SQL Editor (atau: npx supabase db push).
--
-- Konteks: papan ini client-authoritative (client yang kirim angka).
-- Unit 1 sudah nutup akses "orang luar" ke player_saves, tapi PEMILIK
-- akun yang login tetap bisa curl/F12 manggil submit_leaderboard_score
-- dengan p_value ngawur (mis. 1e21) dan langsung jadi #1.
--
-- Yang dilakukan migration ini (signature RPC TETAP sama → client tidak
-- perlu diubah; hanya body + kolom tracking):
--   1. PLAFON ABSOLUT per papan, diambil dari DATA GAME (bukan angka
--      acak). Nilainya jauh di atas build legit terkuat → pemain asli
--      tidak kena, tapi balasan 1e21 "1 in 1Sx" diblok.
--        inf_tower   ≤ 1.000.000 lantai   (top live 79; legit max dibatasi
--                                          laju, lihat 2)
--        deck_power  ≤ 1.000.000.000      (whale max riil ±340 juta:
--                                          ShadowKing 38900 base × mut100
--                                          × shiny5 × trait bigbang; 4 slot)
--        rarest_pull ≤ 1e20               (chance kartu max 1e10 [Astral
--                                          Devourer] × shiny 50 × ultima 1e8
--                                          = 5e19; plafon kasih 2× margin)
--   2. ANTI-JUMP (laju naik): tiap submit cuma boleh NAIK sampai batas.
--      - baris BARU (minggu pertama / skor pertama): dibatasi `first`.
--      - baris LAMA: dibatasi `old × step_mul + step_add`.
--      inf_tower pakai langkah linear +200/submit (orang asli naik +1/
--      lantai, jadi +200 sangat longgar). deck/rarest pakai pengali besar
--      karena upgrade kartu legit memang bisa lompat (rarest bisa ×1000
--      sekali tarik hoki) — buat mereka plafon absolut yang jadi pagar.
--   3. RATE-LIMIT harian: maks `c_daily_max` KENAIKAN per (user,papan)
--      per hari. Ini yang bikin brute-force "seret naik pelan-pelan" lewat
--      curl jadi tidak praktis. Kenaikan > kuota hari itu DITOLAK (skor
--      lama tetap), bukan bikin error — client baca value balik normal.
--
-- Catatan jujur: papan deck_power & rarest_pull TIDAK bisa airtight dari
-- sisi server selama angkanya dikirim client — legit & cheat berada di
-- rentang yang sama, jadi yang didapat di sini cuma "tidak bisa seenaknya
-- 1e21 + tidak bisa numpuk cepat". Yang benar-benar menutup dua papan itu
-- = Unit 3 (server RNG / kepemilikan kartu server-side), karena server
-- jadi tahu kartu apa yang beneran kamu tarik. inf_tower yang paling
-- keras kena manfaatnya (lajunya linear & bisa divalidasi).
-- ===========================================================

-- 1) kolom tracking laju & kuota harian
alter table public.leaderboard_scores
  add column if not exists inc_day   text,
  add column if not exists inc_count integer not null default 0;

-- 2) rewrite submit dengan plafon + anti-jump + rate-limit
create or replace function public.submit_leaderboard_score(
  p_username      text,
  p_password_hash text,
  p_board         text,
  p_value         numeric,
  p_meta          jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname     text := lower(coalesce(p_username, ''));
  brd       text := p_board;
  per       text := public.lb_period(false);   -- papan non-WB = mingguan (ISO week)
  stored_pw text;
  req       numeric;
  meta      jsonb := coalesce(p_meta, '{}'::jsonb);

  -- ---- PLAFON / ATURAN LAJU per papan (EDIT ANGKA DI SINI) ----
  c_abs       numeric;   -- plafon absolut nilai
  c_step_mul  numeric;   -- lama: old × ini
  c_step_add  numeric;   -- lama: + ini per submit
  c_first     numeric;   -- skor pertama (baris baru) maks segini
  c_daily_max integer := 500;   -- maks KENAIKAN / user / papan / hari

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
  if uname = '' then
    raise exception 'BAD_INPUT';
  end if;
  if brd is null or brd not in ('inf_tower', 'deck_power', 'rarest_pull') then
    raise exception 'BAD_BOARD';
  end if;
  if jsonb_typeof(meta) <> 'object' or pg_column_size(meta) > 2048 then
    meta := '{}'::jsonb;
  end if;
  req := greatest(0, least(coalesce(p_value, 0), 1e21::numeric));

  select password into stored_pw
    from public.player_saves where username = uname;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  -- pilih aturan per papan
  if brd = 'inf_tower' then
    c_abs := 1000000;  c_step_mul := 1;    c_step_add := 200; c_first := 1000;
  elsif brd = 'deck_power' then
    c_abs := 1000000000; c_step_mul := 10; c_step_add := 0;   c_first := 1000000000;
  else -- rarest_pull
    c_abs := 1e20;     c_step_mul := 1000; c_step_add := 0;   c_first := 1e20;
  end if;

  select value, inc_day, inc_count into old_val, old_day, old_cnt
    from public.leaderboard_scores
   where period = per and board = brd and username = uname;

  -- tidak ada kenaikan (atau nilai ≤ skor yang tersimpan) → simpan apa adanya,
  -- skor tidak pernah turun. Kembalikan skor kini.
  if old_val is not null and old_val >= req then
    row_value := old_val;
    select updated_at into row_at
      from public.leaderboard_scores
     where period = per and board = brd and username = uname;
    my_rank := public.lb_rank(per, brd, row_value, row_at);
    return jsonb_build_object('ok', true, 'board', brd, 'period', per,
                              'value', row_value, 'rank', my_rank);
  end if;

  -- nilai efektif = permintaan dipotong plafon absolut lalu anti-jump
  eff := least(req, c_abs);
  if old_val is null then
    eff := least(eff, c_first);
  else
    eff := least(eff, old_val * c_step_mul + c_step_add);
  end if;

  -- hitung ulang kuota hari ini (reset kalau beda hari UTC)
  if old_day is distinct from day_key then
    old_cnt := 0;
  end if;

  -- kalau masih mau naik tapi kuota harian habis → TOLAK naik (skor lama)
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

  return jsonb_build_object(
    'ok', true,
    'board', brd,
    'period', per,
    'value', row_value,
    'rank', my_rank
  );
end;
$$;

revoke all on function public.submit_leaderboard_score(text, text, text, numeric, jsonb) from public;
grant execute on function public.submit_leaderboard_score(text, text, text, numeric, jsonb) to anon, authenticated, service_role;

-- Smoke test (ganti USERNAME / HASH) — harus NAIK terpotong, bukan error:
-- select public.submit_leaderboard_score('USERNAME','HASH','inf_tower', 5000000, '{}'::jsonb);  -- → capped ~ (first 1000 / +200)
-- select public.submit_leaderboard_score('USERNAME','HASH','deck_power', 9e18, '{}'::jsonb);     -- → capped 1e9
-- select public.submit_leaderboard_score('USERNAME','HASH','rarest_pull', 1e21, '{}'::jsonb);    -- → capped 1e20
-- select public.get_leaderboard('inf_tower', null, 10, 'USERNAME');
