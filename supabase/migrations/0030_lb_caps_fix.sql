-- 0030_lb_caps_fix.sql — koreksi plafon papan di 0029
--
-- 0029 memasang plafon `submit_leaderboard_score` yang terlalu ketat untuk
-- papan RAREST PULL: `c_abs = 1e11`, padahal kelangkaan sah bisa jauh di atas
-- itu. effChance = chance_kartu × (shiny ? 50 : 1) × MUT_CHANCE_MULT, dengan
-- chance_kartu maksimum 1e10 (js/data.js) dan ultima ×1e8 → nilai sah
-- maksimum = 1e10 × 50 × 1e8 = 5e19. Contoh sah yang dulu DITOLAK:
--   gold pada kartu 1e10   = 1e12
--   rainbow + shiny pada EX = 1e9 × 1e4 × 50 = 5e14
-- Jadi plafon dinaikkan ke batas teoretis (tidak ada pemain jujur yang kena),
-- dan plafon pertama (c_first) dinaikkan ke 1e15 supaya pull langka normal
-- tidak dipotong saat submit pertama. Anti-jump ×1000 tetap: nilai besar tetap
-- harus tumbuh bertahap, jadi tidak bisa sekali submit langsung mentok.
--
-- DECK POWER tidak diubah: maksimum teoretis = 4 kartu terbaik × ultima(100) ×
-- shiny(5) × bigbang(hp×4/atk×5) = 189.575.000 (dihitung dari card_stat), jadi
-- plafon 2e8 di 0029 sudah di atas batas sah.
--
-- SISA RISIKO (disengaja): nilai rarest_pull tetap kiriman client. Server belum
-- bisa menghitungnya sendiri karena `card_stat` belum menyimpan `chance` per
-- kartu (butuh regenerate `_tmp/gen_0027.cjs`). Selama itu, plafon hanya
-- mencegah inflasi di atas 5e19; penutup penuh = rarity di server (Unit 5).

create or replace function public.submit_leaderboard_score(
  p_board text,
  p_value numeric,
  p_meta  jsonb default '{}'::jsonb
)
returns jsonb
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

  -- ---- PLAFON / ATURAN LAJU per papan (EDIT ANGKA DI SINI) ----
  c_abs       numeric;
  c_step_mul  numeric;
  c_step_add  numeric;
  c_first     numeric;
  c_daily_max integer := 500;

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

  select username into uname from public.player_saves where user_id = v_uid limit 1;
  if uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  -- 0029/0030: plafon per papan. Nilai di atasnya = inflasi, submit DITOLAK.
  if brd = 'inf_tower' then
    c_abs := 9999;          c_step_mul := 1;    c_step_add := 200; c_first := 50;
  elsif brd = 'deck_power' then
    c_abs := 200000000;     c_step_mul := 10;   c_step_add := 0;   c_first := 100000;
  else -- rarest_pull
    c_abs := 50000000000000000000;  c_step_mul := 1000; c_step_add := 0;
    c_first := 1000000000000000;
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

select pg_notify('pgrst', 'reload schema');
