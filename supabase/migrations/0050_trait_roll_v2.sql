-- ============================================================================
-- Migration 0050: Server-Authoritative Trait Roll V2 & Batch Auto Roll
--   1) Updates `public.trait_roll(p_stack_id)` to lock row `for update`, sync
--      rolled trait across BOTH `save_data.charTraits[char]` and all variant
--      stacks of the same base character (`Traits V2`).
--   2) Adds `public.trait_auto_roll(p_char, p_targets, p_max)` to perform up
--      to 50 server-authoritative rolls in a single atomic transaction (stops
--      on target hit or insufficient coins) so client Auto Roll never needs
--      local RNG/coin forgery or bursts >120 RPC/min.
-- ============================================================================

create or replace function public.trait_roll(p_stack_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_save    jsonb;
  v_stacks  jsonb := '[]'::jsonb;
  v_tgt     jsonb := NULL;
  v_char    text;
  v_new     jsonb := '[]'::jsonb;
  v_s       jsonb;
  v_cost    bigint := coalesce((select val from public.roll_config where key='trait_cost'), 500)::bigint;
  v_coins   bigint;
  v_total   numeric := 0;
  v_r       numeric;
  v_k       text := 'common';
  v_t       record;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;
  if p_stack_id is null or p_stack_id = '' then
    return jsonb_build_object('ok',false,'msg','BAD_INPUT');
  end if;

  select username, save_data into v_uname, v_save
    from public.player_saves
   where user_id = v_uid
     for update;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  v_coins := public._coins_of(v_save);
  if v_coins < v_cost then
    return jsonb_build_object('ok',false,'msg','COIN_LESS','coins',v_coins);
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'id' = p_stack_id or (v_tgt is null and v_s->>'char' = p_stack_id) then
      v_tgt := v_s;
      exit;
    end if;
  end loop;

  if v_tgt is NULL then
    return jsonb_build_object('ok',false,'msg','STACK_NOT_FOUND');
  end if;
  v_char := v_tgt->>'char';

  select coalesce(sum(chance),0) into v_total from public.trait_def where coalesce(chance,0) > 0;
  if v_total <= 0 then
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  v_r := random() * v_total;
  for v_t in select k, chance from public.trait_def where coalesce(chance,0) > 0 order by ord loop
    v_r := v_r - v_t.chance;
    if v_r <= 0 then
      v_k := v_t.k;
      exit;
    end if;
  end loop;

  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'char' = v_char then
      v_new := v_new || jsonb_build_array(jsonb_set(v_s, '{trait}', to_jsonb(v_k), true));
    else
      v_new := v_new || jsonb_build_array(v_s);
    end if;
  end loop;

  v_save := jsonb_set(v_save, '{stacks}', v_new, true);
  v_save := jsonb_set(
    v_save,
    '{charTraits}',
    (case when jsonb_typeof(v_save->'charTraits') = 'object' then v_save->'charTraits' else '{}'::jsonb end)
      || jsonb_build_object(v_char, v_k),
    true
  );
  v_save := jsonb_set(v_save, '{coins}', to_jsonb(v_coins - v_cost), true);

  update public.player_saves
     set save_data  = v_save,
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'trait', v_k,
    'char', v_char,
    'coins', (v_coins - v_cost)::bigint,
    'stackId', p_stack_id
  );
end;
$$;

create or replace function public.trait_auto_roll(
  p_char    text,
  p_targets text[],
  p_max     integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_save    jsonb;
  v_stacks  jsonb := '[]'::jsonb;
  v_new     jsonb := '[]'::jsonb;
  v_s       jsonb;
  v_owned   boolean := false;
  v_cost    bigint := coalesce((select val from public.roll_config where key='trait_cost'), 500)::bigint;
  v_coins   bigint;
  v_total   numeric := 0;
  v_ks      text[];
  v_ch      numeric[];
  v_len     integer := 0;
  v_lim     integer := greatest(1, least(coalesce(p_max, 25), 50));
  v_i       integer;
  v_j       integer;
  v_r       numeric;
  v_k       text := 'common';
  v_last_k  text := null;
  v_rolled  integer := 0;
  v_hit     boolean := false;
  v_reason  text := 'BATCH_LIMIT';
  v_rolls   text[] := '{}';
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;
  if p_char is null or p_char = '' or coalesce(array_length(p_targets, 1), 0) = 0 then
    return jsonb_build_object('ok',false,'msg','BAD_INPUT');
  end if;

  select username, save_data into v_uname, v_save
    from public.player_saves
   where user_id = v_uid
     for update;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  select exists (
    select 1 from jsonb_array_elements(v_stacks) el where el->>'char' = p_char
  ) into v_owned;
  if not v_owned then
    return jsonb_build_object('ok',false,'msg','STACK_NOT_FOUND');
  end if;

  v_coins := public._coins_of(v_save);
  if v_coins < v_cost then
    return jsonb_build_object('ok',false,'msg','COIN_LESS','coins',v_coins);
  end if;

  select array_agg(k order by ord), array_agg(chance order by ord), coalesce(sum(chance),0)
    into v_ks, v_ch, v_total
    from public.trait_def
   where coalesce(chance,0) > 0;
  v_len := coalesce(array_length(v_ks, 1), 0);
  if v_len = 0 or v_total <= 0 then
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  for v_i in 1..v_lim loop
    if v_coins < v_cost then
      v_reason := 'COIN_LESS';
      exit;
    end if;
    v_coins  := v_coins - v_cost;
    v_rolled := v_rolled + 1;

    v_r := random() * v_total;
    v_k := 'common';
    for v_j in 1..v_len loop
      v_r := v_r - v_ch[v_j];
      if v_r <= 0 then
        v_k := v_ks[v_j];
        exit;
      end if;
    end loop;

    v_last_k := v_k;
    v_rolls  := array_append(v_rolls, v_k);

    if v_k = any(p_targets) then
      v_hit    := true;
      v_reason := 'TARGET_HIT';
      exit;
    end if;
  end loop;

  if v_rolled > 0 and v_last_k is not null then
    for v_s in select jsonb_array_elements(v_stacks) loop
      if v_s->>'char' = p_char then
        v_new := v_new || jsonb_build_array(jsonb_set(v_s, '{trait}', to_jsonb(v_last_k), true));
      else
        v_new := v_new || jsonb_build_array(v_s);
      end if;
    end loop;

    v_save := jsonb_set(v_save, '{stacks}', v_new, true);
    v_save := jsonb_set(
      v_save,
      '{charTraits}',
      (case when jsonb_typeof(v_save->'charTraits') = 'object' then v_save->'charTraits' else '{}'::jsonb end)
        || jsonb_build_object(p_char, v_last_k),
      true
    );
    v_save := jsonb_set(v_save, '{coins}', to_jsonb(v_coins), true);

    update public.player_saves
       set save_data  = v_save,
           updated_at = now()
     where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'ok', true,
    'char', p_char,
    'trait', v_last_k,
    'coins', v_coins,
    'rolled', v_rolled,
    'spent', (v_rolled::bigint * v_cost),
    'hit', v_hit,
    'reason', v_reason,
    'rolls', to_jsonb(v_rolls)
  );
end;
$$;

revoke all on function public.trait_roll(text) from public, anon;
grant  execute on function public.trait_roll(text) to authenticated, service_role;

revoke all on function public.trait_auto_roll(text, text[], integer) from public, anon;
grant  execute on function public.trait_auto_roll(text, text[], integer) to authenticated, service_role;

notify pgrst, 'reload schema';
