-- ============================================================================
-- 0052 — Server-Authoritative Intan Roll (100K) & Infinite Tower Roll Claims
-- ============================================================================
-- Closes the remaining two client-side card generation paths for logged-in
-- accounts (Stage 2 Server Authority):
--   1) Intan Roll 100K (`bpUseIntanRoll`): previously deducted `intan_credit`
--      via `spend_intan`, then sampled cards locally with `instantRollFast`.
--      Now `public.intan_roll(p_qty, p_luck)` deducts `intan_credit` AND runs
--      server-authoritative multinomial/binomial sampling into `roll_ledger`
--      (pack = 'intan'), updates `save_data.stacks`, `rebirth.essence`, and
--      `totalRolls` atomically.
--   2) Infinite Tower Rolls (`towerEnd` / `stopTower`): previously accumulated
--      `pendingRolls` locally and ran client `instantRoll(pending)`. Now:
--        * `public.claim_tower_tokens(p_floor)` increments
--          `public.tower_roll_ledger.earned_floors` atomically on every valid
--          floor conquer.
--        * `public.claim_tower_rolls(p_floors, p_luck)` consumes available
--          `earned_floors - claimed_floors`, samples `p_floors * 100` pulls
--          on server into `roll_ledger` (pack = 'tower'), updates `save_data`,
--          and returns aggregated results identical to `bulk_roll`.
--
-- Note: `roll_config.ledger_enforce` intentionally remains 0 here because
-- starter cards (`CH_GREEN_BEAST` for post-0036 new accounts) and token-shop
-- boss purchases (`card_edragon`, `card_shadowking` in `spend_tokens`) are not
-- yet recorded in `roll_ledger`.
-- ============================================================================

insert into public.roll_config (key, val) values
  ('intan_max_packs', '10'),
  ('tower_roll_max_floors', '500'),
  ('tower_rolls_per_floor', '100')
on conflict (key) do nothing;

-- ---------- 1) LEDGER LANTAI INFINITE TOWER (sumber kebenaran roll floor) ----------
create table if not exists public.tower_roll_ledger (
  username       text        primary key,
  earned_floors  bigint      not null default 0 check (earned_floors >= 0),
  claimed_floors bigint      not null default 0 check (claimed_floors >= 0),
  updated_at     timestamptz not null default now(),
  constraint tower_roll_ledger_chk check (claimed_floors <= earned_floors)
);

alter table public.tower_roll_ledger enable row level security;
revoke all on table public.tower_roll_ledger from public, anon, authenticated;

-- ---------- 2) HELPER INTERNAL SAMPLER BERSAMA (REUSE _roll_entries + _bulk_count) ----------
-- JANGAN pernah di-grant ke anon/authenticated: menerima p_uid/p_uname/p_save bebas.
create or replace function public._server_bulk_sample(
  p_uid      uuid,
  p_uname    text,
  p_save     jsonb,
  p_pack_tag text,
  p_pulls    bigint,
  p_luck     numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_save      jsonb := coalesce(p_save, '{}'::jsonb);
  v_aw        text;
  v_l         numeric;
  v_l_srv     numeric;
  v_s_mult    numeric := 1;
  v_e         jsonb;
  v_wtot      numeric := 0;
  v_wrem      numeric := 0;
  v_w         numeric;
  v_p         numeric;
  v_entries   jsonb[];
  v_s         jsonb;
  v_x         integer;
  v_rem       bigint;
  v_stacks    jsonb;
  v_have      jsonb;
  v_key       text;
  v_has       boolean;
  v_newn      integer;
  v_dupn      integer;
  v_new       jsonb := '[]'::jsonb;
  v_res       jsonb := '[]'::jsonb;
  v_led       jsonb := '[]'::jsonb;
  v_ns        jsonb;
  v_ns_id     text;
  v_eff       numeric;
  v_ess       numeric := 0;
  v_new_count integer := 0;
  v_dup_count integer := 0;
  v_rarest_ch numeric := -1e18;
  v_rarest    jsonb := NULL;
begin
  if p_pulls is null or p_pulls <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_PULLS');
  end if;

  v_aw := case when v_save->'weather' is not null
                and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
           then v_save->'weather'->>'id' else null end;

  v_l_srv := public._luck_of(v_save, p_uname);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_s_mult := public._pass_shiny_mult(p_uname);
  v_e      := public._roll_entries(v_save, v_aw, v_l, v_s_mult);
  v_wtot   := coalesce((v_e->>'total')::numeric, 0);
  v_wrem   := v_wtot;

  if v_wtot <= 0 or jsonb_typeof(v_e->'entries') <> 'array'
                  or jsonb_array_length(v_e->'entries') = 0 then
    return jsonb_build_object('ok', false, 'msg', 'EMPTY_POOL');
  end if;

  select coalesce(array_agg(e order by (e->>'w')::numeric asc), '{}') into v_entries
    from jsonb_array_elements(v_e->'entries') e;

  v_stacks := coalesce(v_save->'stacks', '[]'::jsonb);
  select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) into v_have
    from (select distinct (s->>'char') || '|' ||
                 coalesce(nullif(s->>'mut',''), 'none') || '|' ||
                 case when coalesce(s->>'shiny','false') in ('true','1') then '1' else '0' end as k
          from jsonb_array_elements(v_stacks) s) t;

  v_rem := p_pulls;
  foreach v_s in array v_entries loop
    exit when v_rem <= 0;
    v_w := coalesce((v_s->>'w')::numeric, 0);
    if v_w <= 0 then continue; end if;
    v_p    := v_w / v_wrem;
    v_wrem := v_wrem - v_w;
    v_x    := public._bulk_count(v_rem, v_p);
    if v_x is null or v_x <= 0 then continue; end if;
    if v_x > v_rem then v_x := v_rem::integer; end if;
    v_rem := v_rem - v_x;

    v_key := (v_s->>'char') || '|' || (v_s->>'mut') || '|' ||
             case when (v_s->>'shiny') = 'true' then '1' else '0' end;
    v_has := (v_have ? v_key);
    v_newn := case when v_has then 0 else 1 end;
    v_dupn := v_x - v_newn;

    v_eff := ceil((v_s->>'ch')::numeric / v_l);
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'cardId', v_s->>'char', 'tier', v_s->>'tier', 'mut', v_s->>'mut',
      'shiny', (v_s->>'shiny') = 'true', 'chance', (v_s->>'ch')::numeric,
      'eff', v_eff, 'n', v_x, 'new', v_newn, 'dup', v_dupn));

    if v_newn = 1 then
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text), 1, 9);
      v_ns := jsonb_build_object(
        'id', v_ns_id, 'char', v_s->>'char', 'tier', v_s->>'tier', 'fav', false, 'lock', false,
        'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true', 'trait', 'none', 'count', 1);
      v_stacks := v_stacks || jsonb_build_array(v_ns);
      v_new    := v_new || jsonb_build_array(v_ns);
      v_have   := jsonb_set(v_have, array[v_key], 'true'::jsonb, true);
      v_new_count := v_new_count + 1;
      v_led := v_led || jsonb_build_array(jsonb_build_object(
        'char', v_s->>'char', 'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true',
        'dup', false, 'n', 1));
      if (v_s->>'ch')::numeric > v_rarest_ch then
        v_rarest_ch := (v_s->>'ch')::numeric;
        v_rarest := jsonb_build_object('char', v_s->>'char', 'mut', v_s->>'mut',
          'shiny', (v_s->>'shiny') = 'true', 'ch', v_rarest_ch);
      end if;
    end if;

    if v_dupn > 0 then
      v_ess := v_ess + public._dup_sell_value(v_s->>'tier', (v_s->>'bc')::numeric,
                                              v_s->>'mut', (v_s->>'shiny') = 'true') * v_dupn;
      v_dup_count := v_dup_count + v_dupn;
      v_led := v_led || jsonb_build_array(jsonb_build_object(
        'char', v_s->>'char', 'mut', v_s->>'mut', 'shiny', (v_s->>'shiny') = 'true',
        'dup', true, 'n', v_dupn));
    end if;
  end loop;

  if v_rem > 0 then
    v_ess := v_ess + public._dup_sell_value(NULL, 0, 'none', false) * v_rem;
    v_dup_count := v_dup_count + v_rem::integer;
  end if;

  if jsonb_array_length(v_led) > 0 then
    insert into public.roll_ledger (username, user_id, pack, card_id, mut, shiny, dup, n)
    select p_uname, p_uid, coalesce(nullif(p_pack_tag,''), 'none'), t->>'char', t->>'mut',
           (t->>'shiny') = 'true', (t->>'dup') = 'true', (t->>'n')::integer
      from jsonb_array_elements(v_led) t
    on conflict (username, pack, card_id, mut, shiny, dup)
      do update set n = public.roll_ledger.n + excluded.n,
                    last_at = now(),
                    user_id = coalesce(excluded.user_id, public.roll_ledger.user_id);
  end if;

  v_save := jsonb_set(v_save, '{stacks}', v_stacks);
  if v_ess > 0 then
    if v_save->'rebirth' is null then
      v_save := jsonb_set(v_save, '{rebirth}', jsonb_build_object('count',0,'essence',0));
    end if;
    v_save := jsonb_set(v_save, array['rebirth','essence'],
                        to_jsonb(coalesce((v_save->'rebirth'->>'essence')::numeric, 0) + v_ess));
  end if;
  v_save := jsonb_set(v_save, '{totalRolls}',
                      to_jsonb(coalesce((v_save->>'totalRolls')::bigint, 0) + p_pulls));

  return jsonb_build_object(
    'ok', true,
    'save_data', v_save,
    'total', p_pulls,
    'results', v_res,
    'newStacks', v_new,
    'newCount', v_new_count,
    'dupCount', v_dup_count,
    'rebirthGain', v_ess,
    'rarestPull', v_rarest,
    'luck', v_l,
    'luckServer', v_l_srv,
    'shinyMult', v_s_mult
  );
end;
$fn$;

-- ---------- 3) RPC: INTAN ROLL 100K SERVER-AUTHORITATIVE ----------
create or replace function public.intan_roll(
  p_qty  integer default 1,
  p_luck numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid        uuid := auth.uid();
  v_uname      text;
  v_save       jsonb;
  v_credit     integer := 0;
  v_max        integer := coalesce((select val from public.roll_config where key='intan_max_packs'), 10)::integer;
  v_req        integer := greatest(1, least(coalesce(p_qty, 1), 50));
  v_use        integer := 0;
  v_per_intan  bigint  := coalesce((select val from public.roll_config where key='intan_pulls'), 100000)::bigint;
  v_pulls      bigint  := 0;
  v_sample     jsonb;
  v_save_next  jsonb;
  v_next_cred  integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;

  select username, save_data, coalesce(intan_credit, 0)
    into v_uname, v_save, v_credit
    from public.player_saves
   where user_id = v_uid
     for update;

  if v_uname is null or v_save is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  v_credit := coalesce(v_credit, 0);
  if v_credit <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'NO_INTAN', 'credit', 0);
  end if;

  v_use   := least(v_req, v_credit, greatest(1, v_max));
  v_pulls := v_use::bigint * greatest(1, v_per_intan);

  v_sample := public._server_bulk_sample(v_uid, v_uname, v_save, 'intan', v_pulls, p_luck);
  if not coalesce((v_sample->>'ok')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'msg', coalesce(v_sample->>'msg', 'ROLL_FAILED'),
      'credit', v_credit
    );
  end if;

  v_next_cred := v_credit - v_use;
  v_save_next := jsonb_set(v_sample->'save_data', '{intanRolls}', to_jsonb(v_next_cred), true);

  update public.player_saves
     set intan_credit = v_next_cred,
         save_data    = v_save_next,
         updated_at   = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'spent', v_use,
    'credit', v_next_cred,
    'total', (v_sample->>'total')::bigint,
    'results', v_sample->'results',
    'newStacks', v_sample->'newStacks',
    'newCount', (v_sample->>'newCount')::integer,
    'dupCount', (v_sample->>'dupCount')::integer,
    'rebirthGain', (v_sample->>'rebirthGain')::numeric,
    'rarestPull', v_sample->'rarestPull',
    'luck', (v_sample->>'luck')::numeric,
    'luckServer', (v_sample->>'luckServer')::numeric,
    'shinyMult', (v_sample->>'shinyMult')::numeric
  );
end;
$fn$;

-- ---------- 4) UPDATE claim_tower_tokens: CATAT earned_floors KE tower_roll_ledger ----------
-- Identik dengan 0029 + upsert tower_roll_ledger.earned_floors += 1 pada klaim sah.
create or replace function public.claim_tower_tokens(p_floor integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_claims constant integer := 800;
  c_earn   constant bigint  := 5000;
  v_uid    uuid := auth.uid();
  v_uname  text;
  v_gain   integer;
  v_claims integer;
  v_earned bigint;
  v_bal    integer;
  v_front  integer;
  v_limit  integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_floor is null or p_floor < 1 or p_floor > 9999 then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select coalesce(max_floor, 0) into v_front
    from public.tower_progress where username = v_uname;
  v_limit := greatest(coalesce(v_front, 0) + 5, 15);
  if p_floor > v_limit then
    perform public._tamper(v_uname, 'CLAIM_UNREACHABLE', 'claim_tower_tokens',
                           p_floor::text, v_limit::text);
    return jsonb_build_object('ok', false, 'msg', 'UNREACHABLE',
                              'max', v_limit);
  end if;

  v_gain := case when p_floor % 5 = 0 then 5 else 1 end;

  select coalesce(claims, 0), coalesce(earned, 0) into v_claims, v_earned
    from public.token_daily
   where username = v_uname and day = (now() at time zone 'utc')::date;
  if coalesce(v_claims, 0) + 1 > c_claims then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_claims);
  end if;
  if coalesce(v_earned, 0) + v_gain > c_earn then
    return jsonb_build_object('ok', false, 'msg', 'DAILY_CAP', 'cap', c_earn);
  end if;

  update public.player_saves
     set save_data = jsonb_set(
           coalesce(save_data, '{}'::jsonb), '{infTokens}',
           to_jsonb(public._token_of(save_data, 'infTokens') + v_gain), true),
         updated_at = now()
   where user_id = v_uid
   returning public._token_of(save_data, 'infTokens') into v_bal;

  if v_bal is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  insert into public.token_daily (username, day, claims, earned)
  values (v_uname, (now() at time zone 'utc')::date, 1, v_gain)
  on conflict (username, day) do update
     set claims = public.token_daily.claims + 1,
         earned = public.token_daily.earned + excluded.earned;

  insert into public.tower_progress (username, max_floor)
  values (v_uname, p_floor)
  on conflict (username) do update
    set max_floor = greatest(public.tower_progress.max_floor, excluded.max_floor),
        updated_at = now();

  insert into public.tower_roll_ledger (username, earned_floors, claimed_floors, updated_at)
  values (v_uname, 1, 0, now())
  on conflict (username) do update
    set earned_floors = public.tower_roll_ledger.earned_floors + 1,
        updated_at = now();

  return jsonb_build_object('ok', true, 'gained', v_gain,
                            'tokens', v_bal, 'infTokens', v_bal);
end;
$$;

-- ---------- 5) RPC: KLAIM ROLL INFINITE TOWER SERVER-AUTHORITATIVE ----------
create or replace function public.claim_tower_rolls(
  p_floors integer default 1,
  p_luck   numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid        uuid := auth.uid();
  v_uname      text;
  v_save       jsonb;
  v_earned     bigint := 0;
  v_claimed    bigint := 0;
  v_avail      bigint := 0;
  v_max        integer := coalesce((select val from public.roll_config where key='tower_roll_max_floors'), 500)::integer;
  v_per_floor  bigint  := coalesce((select val from public.roll_config where key='tower_rolls_per_floor'), 100)::bigint;
  v_req        integer := greatest(1, least(coalesce(p_floors, 1), 1000));
  v_use        integer := 0;
  v_pulls      bigint  := 0;
  v_sample     jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;

  select username, save_data
    into v_uname, v_save
    from public.player_saves
   where user_id = v_uid
     for update;

  if v_uname is null or v_save is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  select coalesce(earned_floors, 0), coalesce(claimed_floors, 0)
    into v_earned, v_claimed
    from public.tower_roll_ledger
   where username = v_uname
     for update;

  v_avail := greatest(0, coalesce(v_earned, 0) - coalesce(v_claimed, 0));
  if v_avail <= 0 then
    return jsonb_build_object('ok', false, 'msg', 'NO_TOWER_ROLLS', 'available', 0);
  end if;

  v_use   := least(v_req, v_avail, greatest(1, v_max))::integer;
  v_pulls := v_use::bigint * greatest(1, v_per_floor);

  v_sample := public._server_bulk_sample(v_uid, v_uname, v_save, 'tower', v_pulls, p_luck);
  if not coalesce((v_sample->>'ok')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'msg', coalesce(v_sample->>'msg', 'ROLL_FAILED'),
      'available', v_avail
    );
  end if;

  update public.tower_roll_ledger
     set claimed_floors = claimed_floors + v_use,
         updated_at     = now()
   where username = v_uname;

  update public.player_saves
     set save_data  = v_sample->'save_data',
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'used', v_use,
    'remaining', v_avail - v_use,
    'total', (v_sample->>'total')::bigint,
    'results', v_sample->'results',
    'newStacks', v_sample->'newStacks',
    'newCount', (v_sample->>'newCount')::integer,
    'dupCount', (v_sample->>'dupCount')::integer,
    'rebirthGain', (v_sample->>'rebirthGain')::numeric,
    'rarestPull', v_sample->'rarestPull',
    'luck', (v_sample->>'luck')::numeric,
    'luckServer', (v_sample->>'luckServer')::numeric,
    'shinyMult', (v_sample->>'shinyMult')::numeric
  );
end;
$fn$;

-- ---------- 6) ACL (TEGAS TUTUP HELPER & ANON) ----------
do $$
begin
  execute 'revoke all on function public._server_bulk_sample(uuid,text,jsonb,text,bigint,numeric) from public, anon, authenticated';
  execute 'grant execute on function public._server_bulk_sample(uuid,text,jsonb,text,bigint,numeric) to service_role';

  execute 'revoke all on function public.intan_roll(integer,numeric) from public, anon';
  execute 'grant execute on function public.intan_roll(integer,numeric) to authenticated, service_role';

  execute 'revoke all on function public.claim_tower_tokens(integer) from public, anon';
  execute 'grant execute on function public.claim_tower_tokens(integer) to authenticated, service_role';

  execute 'revoke all on function public.claim_tower_rolls(integer,numeric) from public, anon';
  execute 'grant execute on function public.claim_tower_rolls(integer,numeric) to authenticated, service_role';
end $$;

notify pgrst, 'reload schema';
