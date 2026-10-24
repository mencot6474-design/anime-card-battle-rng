-- ===========================================================
-- LEADERBOARD SUBMIT — papan mingguan: inf_tower / deck_power / rarest_pull
-- Jalankan di Supabase SQL Editor (atau: npx supabase db push).
--
-- Model keamanan sama dengan submit World Boss:
--  - SECURITY DEFINER + verifikasi password hash ke player_saves.password.
--  - Tabel leaderboard_scores tetap RPC-only (client tidak bisa INSERT langsung).
--  - Skor hanya naik (upsert bersyarat value < baru), jadi tidak bisa turun.
-- ===========================================================

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
  val       numeric;
  meta      jsonb := coalesce(p_meta, '{}'::jsonb);
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
  -- Plafon 1e21 (unit "Sx" di fmtChance): rarest pull bisa >1e15 (200q+).
  val := greatest(0, least(coalesce(p_value, 0), 1e21::numeric));

  select password into stored_pw
    from public.player_saves where username = uname;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  insert into public.leaderboard_scores (period, board, username, value, meta, updated_at)
  values (per, brd, uname, val, meta, now())
  on conflict (period, board, username) do update
    set value = excluded.value,
        meta = excluded.meta,
        updated_at = now()
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

-- Smoke test (ganti USERNAME / HASH):
-- select public.submit_leaderboard_score('USERNAME', 'HASH', 'inf_tower', 42, '{}'::jsonb);
-- select public.get_leaderboard('inf_tower', null, 10, 'USERNAME');
-- select public.submit_leaderboard_score('USERNAME', 'HASH', 'deck_power', 128400, '{}'::jsonb);
-- select public.submit_leaderboard_score('USERNAME', 'HASH', 'rarest_pull', 12000, '{"name":"SHADOW KING"}'::jsonb);
