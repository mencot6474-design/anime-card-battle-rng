-- ===========================================================
-- 0006: fix world_boss_state — record "ybr" is not assigned yet
-- ===========================================================
-- Bug: `ybr record` diakses di dalam ekspresi jsonb_build_object(CASE ...),
-- sehingga planner PL/pgSQL menyentuh field record walau cabang CASE tidak
-- dijalankan -> error 55000 untuk semua user yang belum punya skor kemarin.
-- Fix: deklarasikan sebagai rowtype function (field statis = NULL sebelum diisi).
--
-- Jalankan seluruh file ini di Supabase SQL Editor (aman diulang).

create or replace function public.world_boss_state(
  p_username text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uname    text := lower(p_username);
  stored_pw text;
  info     public.world_boss_days;
  used     integer := 0;
  best     numeric := 0;
  total    integer := 0;
  my_rank  integer;
  yday     date := public.lb_day() - 1;
  yper     text;
  ybest    numeric;
  yrank    integer;
  ytotal   integer;
  ybr      public.world_boss_bracket;
  yclaimed boolean := false;
  yrow     public.world_boss_runs;
  yjson    jsonb;
begin
  if p_username is null then
    raise exception 'BAD_INPUT';
  end if;

  select password into stored_pw
    from public.player_saves where username = uname;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  info := public.world_boss_day_info();

  select * into yrow from public.world_boss_runs
   where day = public.lb_day() and username = uname;

  if found then
    used := yrow.attempts;
    best := yrow.best_pct;
  end if;

  select count(*) into total
    from public.leaderboard_scores
   where period = public.lb_period(true) and board = 'world_boss';

  if best > 0 then
    select public.lb_rank(public.lb_period(true), 'world_boss', value, updated_at)
      into my_rank
      from public.leaderboard_scores
     where period = public.lb_period(true) and board = 'world_boss' and username = uname;
  end if;

  -- Reward kemarin
  yper := to_char(yday, 'YYYY-MM-DD');

  select s.value, public.lb_rank(yper, 'world_boss', s.value, s.updated_at)
    into ybest, yrank
    from public.leaderboard_scores s
   where s.period = yper and s.board = 'world_boss' and s.username = uname;

  if ybest is not null then
    select count(*) into ytotal from public.leaderboard_scores where period = yper and board = 'world_boss';
    select * into ybr from public.world_boss_bracket(yrank, ybest);
    select exists(
      select 1 from public.leaderboard_claims
       where period = yper and board = 'world_boss' and username = uname
    ) into yclaimed;

    yjson := jsonb_build_object(
      'period', yper,
      'best_pct', ybest,
      'rank', yrank,
      'total_players', ytotal,
      'bracket', ybr.bracket,
      'gems', ybr.gems,
      'tokens', ybr.tokens,
      'title', ybr.title,
      'claimed', yclaimed,
      'claimable', (not yclaimed) and (ybr.tokens > 0)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'day', info.day,
    'boss_id', info.boss_id,
    'modifier', info.modifier,
    'attempts_used', used,
    'attempts_left', 3 - used,
    'best_pct', best,
    'rank', my_rank,
    'total_players', total,
    'yesterday', yjson
  );
end;
$$;

revoke all on function public.world_boss_state(text, text) from public;
grant execute on function public.world_boss_state(text, text) to anon, authenticated, service_role;

-- Verifikasi cepat (ganti dengan akun uji):
-- select public.world_boss_state('wbtest', '<hash>');
