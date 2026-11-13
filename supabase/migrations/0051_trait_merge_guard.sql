-- ============================================================================
-- Migration 0051: Authoritative Trait Vault Swap & merge_player_state Guard
--   1) Adds `public.trait_swap_vault(p_char)` so Trait Vault swaps/parks run
--      atomically on the server and persist across reloads.
--   2) Hardens `public.merge_player_state` (preserving all 0045_speed_3x_pass
--      logic) to strip client-forged `charTraits`, `traitVault`, and
--      `stacks[*].trait`, restoring authoritative server trait maps from
--      `old_save` instead.
-- ============================================================================

create or replace function public.trait_swap_vault(p_char text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid         uuid := auth.uid();
  v_char        text := nullif(btrim(coalesce(p_char, '')), '');
  v_uname       text;
  v_save        jsonb;
  v_stacks      jsonb := '[]'::jsonb;
  v_new         jsonb := '[]'::jsonb;
  v_s           jsonb;
  v_owned       boolean := false;
  v_ct          jsonb;
  v_tv          jsonb;
  v_cur         text := null;
  v_vk          text := null;
  v_next_active text;
  v_next_vault  text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;
  if v_char is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;

  select username, save_data into v_uname, v_save
    from public.player_saves
   where user_id = v_uid
     for update;

  if v_uname is null or v_save is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  v_stacks := case when jsonb_typeof(v_save->'stacks') = 'array' then v_save->'stacks' else '[]'::jsonb end;
  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'char' = v_char then
      v_owned := true;
      exit;
    end if;
  end loop;
  if not v_owned then
    return jsonb_build_object('ok', false, 'msg', 'CHAR_NOT_OWNED');
  end if;

  v_ct := case when jsonb_typeof(v_save->'charTraits') = 'object' then v_save->'charTraits' else '{}'::jsonb end;
  v_tv := case when jsonb_typeof(v_save->'traitVault') = 'object' then v_save->'traitVault' else '{}'::jsonb end;

  -- Resolve current active trait from charTraits first, falling back to any owned variant stack
  v_cur := nullif(v_ct->>v_char, '');
  if v_cur is not null and v_cur <> 'none' then
    if not exists (select 1 from public.trait_def td where td.k = v_cur) then
      v_cur := null;
    end if;
  else
    v_cur := null;
  end if;

  if v_cur is null then
    for v_s in select jsonb_array_elements(v_stacks) loop
      if v_s->>'char' = v_char
         and nullif(v_s->>'trait', '') is not null
         and (v_s->>'trait') <> 'none'
         and exists (select 1 from public.trait_def td where td.k = (v_s->>'trait')) then
        v_cur := v_s->>'trait';
        exit;
      end if;
    end loop;
  end if;

  -- Resolve current vaulted trait (must exist in trait_def)
  v_vk := nullif(v_tv->>v_char, '');
  if v_vk is not null and (v_vk = 'none' or not exists (select 1 from public.trait_def td where td.k = v_vk)) then
    v_vk := null;
  end if;

  if v_cur is null and v_vk is null then
    return jsonb_build_object('ok', false, 'msg', 'BOTH_EMPTY');
  end if;

  v_next_active := coalesce(v_vk, 'none');
  v_next_vault  := v_cur;

  v_ct := v_ct || jsonb_build_object(v_char, v_next_active);
  if v_next_vault is not null then
    v_tv := v_tv || jsonb_build_object(v_char, v_next_vault);
  else
    v_tv := v_tv - v_char;
  end if;

  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'char' = v_char then
      v_new := v_new || jsonb_build_array(jsonb_set(v_s, '{trait}', to_jsonb(v_next_active), true));
    else
      v_new := v_new || jsonb_build_array(v_s);
    end if;
  end loop;

  v_save := jsonb_set(v_save, '{stacks}', v_new, true);
  v_save := jsonb_set(v_save, '{charTraits}', v_ct, true);
  v_save := jsonb_set(v_save, '{traitVault}', v_tv, true);

  update public.player_saves
     set save_data  = v_save,
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'char', v_char,
    'active', v_next_active,
    'vault', v_next_vault,
    'charTraits', v_ct,
    'traitVault', v_tv
  );
end;
$$;

create or replace function public.merge_player_state(
  p_save_data jsonb,
  p_allow_gem_decrease boolean default false,
  p_skip_stacks boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  c_xp_daily  constant bigint  := 5000000;
  c_xp_push   constant bigint  := 200000;
  c_reb_daily constant bigint  := 50000000;
  c_lv_max    constant integer := 9999;
  c_reb_max   constant integer := 40;
  v_uid     uuid := auth.uid();
  uname     text;
  cur_gems  integer;
  new_gems  integer;
  cur_coins bigint;
  spent     bigint;
  cur_wb    integer;
  cur_inf   integer;
  cur_lv    integer;
  cur_xp    bigint;
  xp_gain   bigint;
  xp_today  bigint;
  new_lv    integer;
  new_xp    bigint;
  merged    jsonb;
  old_save  jsonb;
  v_player  jsonb;
  cur_lb    numeric;
  cur_lf    numeric;
  cur_lp    numeric;
  cur_legacy integer;
  cur_sp_avail integer;
  cur_reb_today bigint;
  cur_reb_cnt   integer;
  cur_reb_gain  bigint;
  v_reb_do      integer;
  v_reb_cnt_new integer;
  v_reb_gain_new bigint;
  v_sp_spend    integer;
  v_new_sp_avail integer;
  v_spent_calc  bigint;
  v_pet         jsonb;
  v_art         jsonb;
  v_pass        jsonb;
  v_budget      bigint;
  v_new_coins   bigint;
  v_id          text;
  v_s1          text;
  v_s2          text;
  v_spd         integer;
  v_max_spd     integer;
  v_now_iso     text;
  v_prev_upd    timestamptz;
  v_srv_ct      jsonb := '{}'::jsonb;
  v_srv_tv      jsonb := '{}'::jsonb;
  v_old_s       jsonb;
  v_synced_st   jsonb := '[]'::jsonb;
  v_tr_key      text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_save_data is null or jsonb_typeof(p_save_data) <> 'object' then
    raise exception 'INVALID_SAVE_DATA';
  end if;

  select username, save_data, updated_at
    into uname, old_save, v_prev_upd
    from public.player_saves
   where user_id = v_uid
     for update;

  if uname is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  merged := p_save_data;

  -- Snapshot authoritative trait state from old_save before merging
  if old_save is not null then
    if jsonb_typeof(old_save->'charTraits') = 'object' then
      v_srv_ct := old_save->'charTraits';
    end if;
    if jsonb_typeof(old_save->'traitVault') = 'object' then
      v_srv_tv := old_save->'traitVault';
    end if;
    -- Backfill any pre-charTraits legacy stack trait stored in old_save
    if jsonb_typeof(old_save->'stacks') = 'array' then
      for v_old_s in select jsonb_array_elements(old_save->'stacks') loop
        v_tr_key := nullif(v_old_s->>'trait', '');
        if nullif(v_old_s->>'char', '') is not null
           and v_tr_key is not null
           and v_tr_key <> 'none'
           and (nullif(v_srv_ct->>(v_old_s->>'char'), '') is null or (v_srv_ct->>(v_old_s->>'char')) = 'none')
           and exists (select 1 from public.trait_def td where td.k = v_tr_key) then
          v_srv_ct := v_srv_ct || jsonb_build_object(v_old_s->>'char', v_tr_key);
        end if;
      end loop;
    end if;
  end if;

  if p_skip_stacks and old_save is not null and old_save ? 'stacks' then
    merged := jsonb_set(merged, '{stacks}', old_save->'stacks', true);
  end if;

  -- Tarik saldo authoritative server
  cur_gems  := coalesce(public.get_player_gems(uname), 0);
  cur_coins := coalesce(public._coins_of(uname), 0);
  cur_wb    := coalesce(public._tokens_of(uname, 'wb'), 0);
  cur_inf   := coalesce(public._tokens_of(uname, 'inf'), 0);
  cur_lv    := coalesce(public._level_of(uname), 1);
  cur_xp    := coalesce(public._xp_of(uname), 0);

  spent := 0;
  if p_save_data ? '_spent' and (p_save_data->>'_spent') ~ '^[0-9]{1,15}$' then
    spent := (p_save_data->>'_spent')::bigint;
  end if;
  spent := greatest(0, spent);

  xp_gain := case
               when coalesce(merged->>'_xpGain','') ~ '^[0-9]{1,9}$'
               then (merged->>'_xpGain')::bigint
               else 0
             end;

  v_player := case
                when jsonb_typeof(merged->'player') = 'object' then merged->'player'
                else '{}'::jsonb
              end;

  cur_lb := coalesce(public._lb_of(old_save), 0);
  cur_lf := coalesce(public._lf_of(old_save), 0);
  cur_lp := coalesce(public._lp_of(old_save), 0);
  cur_legacy := coalesce(public._sp_legacy_of(uname), 0);
  cur_sp_avail := coalesce(public._sp_available_of(old_save), 0);
  cur_reb_today := coalesce(public._rebirth_today_of(uname), 0);
  cur_reb_cnt := coalesce(public._rebirth_count_of(old_save), 0);
  cur_reb_gain := coalesce(public._rebirth_gained_of(old_save), 0);

  -- Sanitasi progres, cuaca, potion, profil
  merged := public._check_progress(merged, uname);
  merged := public._rebuild_packs(merged, uname);
  merged := public._check_weather(merged, uname);
  merged := public._check_pots(merged, uname);
  merged := public._check_profile(merged, uname, old_save, v_prev_upd);

  -- Bersihkan field client-only (termasuk charTraits & traitVault: 0051 server-authoritative)
  merged := merged - 'coins' - 'premiumGems' - 'wbTokens' - 'infTokens'
                   - 'playerLv' - 'xp' - '_spent' - '_xpGain' - '_spentCalc'
                   - '_rebirthDo' - 'tamper' - 'charTraits' - 'traitVault';

  -- Deduplikasi stacks + ledger check + sinkron trait server
  merged := jsonb_set(merged, '{stacks}', public._clean_stacks(merged->'stacks'), true);

  merged := jsonb_set(merged, '{stacks}',
                      public._validate_stacks_ledger(uname, merged->'stacks'), true);

  for v_old_s in select jsonb_array_elements(coalesce(merged->'stacks', '[]'::jsonb)) loop
    v_tr_key := coalesce(nullif(v_srv_ct->>(v_old_s->>'char'), ''), 'none');
    if v_tr_key <> 'none' and not exists (select 1 from public.trait_def td where td.k = v_tr_key) then
      v_tr_key := 'none';
    end if;
    v_synced_st := v_synced_st || jsonb_build_array(jsonb_set(v_old_s, '{trait}', to_jsonb(v_tr_key), true));
  end loop;
  merged := jsonb_set(merged, '{stacks}', v_synced_st, true);
  merged := jsonb_set(merged, '{charTraits}', v_srv_ct, true);
  merged := jsonb_set(merged, '{traitVault}', v_srv_tv, true);

  merged := jsonb_set(merged, '{deck}', public._clean_deck(merged->'deck', merged->'stacks'), true);
  merged := jsonb_set(merged, '{equippedId}',
    public._clean_equip(merged->>'equippedId', merged->'stacks'), true);
  merged := jsonb_set(merged, '{equippedId2}',
    public._clean_equip(merged->>'equippedId2', merged->'stacks'), true);

  -- Gem authoritative server
  new_gems := cur_gems;
  if p_allow_gem_decrease and (p_save_data ? 'premiumGems') then
    new_gems := greatest(0, (p_save_data->>'premiumGems')::integer);
    if new_gems < cur_gems then
      perform public.spend_gems(uname, cur_gems - new_gems);
    end if;
  end if;
  merged := jsonb_set(merged, '{premiumGems}', to_jsonb(new_gems), true);

  -- XP & Level progression server
  if xp_gain > c_xp_push then
    xp_gain := c_xp_push;
  end if;

  select coalesce(gained, 0) into xp_today
    from public.xp_daily
   where username = uname and day = (now() at time zone 'utc')::date;
  xp_gain := greatest(0, least(xp_gain, c_xp_daily - coalesce(xp_today, 0)));

  if xp_gain > 0 then
    insert into public.xp_daily (username, day, gained)
    values (uname, (now() at time zone 'utc')::date, xp_gain)
    on conflict (username, day) do update
      set gained = public.xp_daily.gained + excluded.gained;
  end if;

  new_xp := cur_xp + xp_gain;
  new_lv := cur_lv;
  while new_lv < c_lv_max and new_xp >= public._xp_req(new_lv) loop
    new_xp := new_xp - public._xp_req(new_lv);
    new_lv := new_lv + 1;
  end loop;

  update public.player_progress
     set lv = new_lv, xp = new_xp, updated_at = now()
   where username = uname;

  -- Rebirth & SP server calculation
  v_reb_do := greatest(0, least(c_reb_max, public._int_of(p_save_data, '_rebirthDo', 0)));
  v_reb_cnt_new := cur_reb_cnt;
  v_reb_gain_new := cur_reb_gain;

  if v_reb_do > cur_reb_cnt then
    declare
      v_cost bigint;
      v_add  bigint;
    begin
      while v_reb_cnt_new < v_reb_do loop
        v_cost := (1000000::bigint) * (1::bigint << least(v_reb_cnt_new, 40));
        v_add  := 500000::bigint;
        if new_xp >= v_cost and cur_reb_today + v_add <= c_reb_daily then
          new_xp := new_xp - v_cost;
          v_reb_cnt_new := v_reb_cnt_new + 1;
          v_reb_gain_new := v_reb_gain_new + v_add;
          cur_reb_today := cur_reb_today + v_add;
        else
          exit;
        end if;
      end loop;
    end;
  end if;

  v_sp_spend := public._sp_spent_in(v_player->'tree');
  v_new_sp_avail := greatest(0, least(
    greatest(0, cur_sp_avail),
    cur_legacy + (new_lv - 1) * 3 - v_sp_spend
  ));

  v_player := jsonb_set(v_player, '{sp}', to_jsonb(v_new_sp_avail), true);
  v_player := jsonb_set(v_player, '{rebirthCount}', to_jsonb(v_reb_cnt_new), true);
  v_player := jsonb_set(v_player, '{rebirthGained}', to_jsonb(v_reb_gain_new), true);
  v_player := jsonb_set(v_player, '{luckBase}', to_jsonb(cur_lb), true);
  v_player := jsonb_set(v_player, '{luckFlat}', to_jsonb(cur_lf), true);
  v_player := jsonb_set(v_player, '{luckPct}', to_jsonb(cur_lp), true);
  merged := jsonb_set(merged, '{player}', v_player, true);

  -- Token & Level server
  merged := jsonb_set(merged, '{wbTokens}',  to_jsonb(cur_wb),  true);
  merged := jsonb_set(merged, '{infTokens}', to_jsonb(cur_inf), true);
  merged := jsonb_set(merged, '{playerLv}',  to_jsonb(new_lv),  true);
  merged := jsonb_set(merged, '{xp}',        to_jsonb(new_xp),  true);

  -- Item belanja & saldo koin (TIDAK PERNAH DI-NOL-KAN, SELALU IKUTI SALDO ASLI SERVER)
  v_spent_calc := greatest(0, public._bigint_of(p_save_data, '_spentCalc', 0));
  spent := greatest(spent, v_spent_calc);

  v_budget := greatest(0, cur_coins);
  v_pet    := public._claim_items(uname, merged->'petOwned', 'pet', v_budget);
  v_budget := greatest(0, v_budget - coalesce((v_pet->>'used')::bigint, 0));
  v_art    := public._claim_items(uname, merged->'artOwned', 'art', v_budget);

  merged := jsonb_set(merged, '{petOwned}', coalesce(v_pet->'kept', '[]'::jsonb), true);
  merged := jsonb_set(merged, '{artOwned}', coalesce(v_art->'kept', '[]'::jsonb), true);

  -- Pass permanen (authoritative dari player_items ledger) + clamp battleSpeed (1..2, atau 1..3 jika punya speed-3x)
  v_pass := public._items_of(uname, 'pass');
  merged := jsonb_set(merged, '{passesOwned}', v_pass, true);
  v_max_spd := case when exists (
    select 1 from public.player_items pi where pi.username = uname and pi.item_id = 'speed-3x'
  ) then 3 else 2 end;
  v_spd := greatest(1, least(v_max_spd, public._int_of(merged, 'battleSpeed', 1)));
  merged := jsonb_set(merged, '{battleSpeed}', to_jsonb(v_spd), true);

  -- Koin selalu mengikuti saldo server dikurangi belanja yang sah:
  v_new_coins := greatest(0, cur_coins - spent);
  merged := jsonb_set(merged, '{coins}', to_jsonb(v_new_coins), true);

  if spent > 0 and cur_coins > 0 then
    perform public.spend_coins(uname, least(cur_coins, spent));
  end if;

  v_id := merged->>'petEquipped';
  if v_id is null or not exists (
       select 1 from jsonb_array_elements_text(merged->'petOwned') o where o = v_id)
  then
    merged := jsonb_set(merged, '{petEquipped}', 'null'::jsonb, true);
  end if;

  v_s1 := null;
  v_s2 := null;
  select o into v_s1 from jsonb_array_elements_text(merged->'artOwned') o
   where o = coalesce(merged->'artSlots'->>0, '') limit 1;
  select o into v_s2 from jsonb_array_elements_text(merged->'artOwned') o
   where o = coalesce(merged->'artSlots'->>1, '') limit 1;

  merged := jsonb_set(merged, '{artSlots}', jsonb_build_array(v_s1, v_s2), true);

  v_now_iso := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  merged := jsonb_set(merged, '{lastSaved}', to_jsonb(v_now_iso), true);

  update public.player_saves
     set save_data = merged,
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'coins', v_new_coins,
    'premiumGems', new_gems,
    'wbTokens', cur_wb,
    'infTokens', cur_inf,
    'playerLv', new_lv,
    'xp', new_xp,
    'petOwned', merged->'petOwned',
    'artOwned', merged->'artOwned',
    'passesOwned', v_pass,
    'battleSpeed', v_spd,
    'petEquipped', merged->'petEquipped',
    'artSlots', merged->'artSlots',
    'rollPacks', merged->'rollPacks',
    'weather', merged->'weather',
    'potions', merged->'potions',
    'mythicPotions', merged->'mythicPotions',
    'luckPots', merged->'luckPots',
    'speedPots', merged->'speedPots',
    'charTraits', v_srv_ct,
    'traitVault', v_srv_tv,
    'penalty', null,
    'tamper', '[]'::jsonb
  );
end;
$$;

revoke all on function public.trait_swap_vault(text) from public, anon;
grant execute on function public.trait_swap_vault(text) to authenticated, service_role;

revoke all on function public.merge_player_state(jsonb, boolean, boolean) from public, anon;
grant execute on function public.merge_player_state(jsonb, boolean, boolean) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
