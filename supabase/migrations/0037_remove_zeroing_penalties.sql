-- 0037_remove_zeroing_penalties.sql
-- Hapus semua penalti yang me-nol-kan / me-reset saldo pemain (F12 DevTools Guard, guard_nuke, coin zeroing).
-- Karena game sudah online dan sinkron dengan Supabase, data di server menjadi sumber kebenaran (authoritative).
-- Jika ada nilai lokal diubah via Inspect/F12 yang tidak sesuai, data otomatis kembali ke nilai asli di Supabase tanpa menghukum pemain.

-- 1. Netralkan RPC report_devtools (tidak mereset save data)
create or replace function public.report_devtools(p_signal text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return jsonb_build_object('ok', true, 'exempt', true, 'reset', false);
end;
$$;

-- 2. Netralkan RPC guard_nuke (tidak me-nuke save data)
create or replace function public.guard_nuke(p_signal text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return jsonb_build_object('ok', true, 'exempt', true, 'nuked', false);
end;
$$;

-- 3. Update _check_pots: clamp ke batas sah daripada me-0-kan
create or replace function public._check_pots(p_merged jsonb, p_uname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims bigint;
  v_ceil   integer;
  v_key    text;
  v_val    integer;
  v_arr    jsonb;
  v_out    jsonb;
  v_i      integer;
  v_n      integer;
begin
  select coalesce(sum(claims), 0) into v_claims
    from public.token_daily where username = p_uname;
  v_ceil := 200 + 2 * coalesce(v_claims, 0);

  foreach v_key in array array['potions', 'mythicPotions'] loop
    v_val := public._int_of(p_merged, v_key, 0);
    if v_val > v_ceil then
      p_merged := jsonb_set(p_merged, array[v_key], to_jsonb(v_ceil), true);
    elsif v_val < 0 then
      p_merged := jsonb_set(p_merged, array[v_key], '0'::jsonb, true);
    end if;
  end loop;

  foreach v_key in array array['luckPots', 'speedPots'] loop
    v_arr := case when jsonb_typeof(p_merged->v_key) = 'array'
                  then p_merged->v_key else '[]'::jsonb end;
    v_out := '[]'::jsonb;
    v_n   := jsonb_array_length(v_arr);
    for v_i in 0..2 loop
      v_val := 0;
      if v_i < v_n then
        v_val := case when coalesce(v_arr->>v_i, '') ~ '^[0-9]{1,9}$'
                      then (v_arr->>v_i)::integer else 0 end;
      end if;
      if v_val > v_ceil then
        v_val := v_ceil;
      end if;
      v_out := v_out || to_jsonb(greatest(0, v_val));
    end loop;
    p_merged := jsonb_set(p_merged, array[v_key], v_out, true);
  end loop;

  return p_merged;
end;
$$;

-- 4. Update merge_player_state: hapus penalti me-0-kan koin, pertahankan nilai asli dari database
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
  v_budget      bigint;
  v_new_coins   bigint;
  v_id          text;
  v_s1          text;
  v_s2          text;
  v_now_iso     text;
  v_prev_upd    timestamptz;
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

  -- Bersihkan field client-only
  merged := merged - 'coins' - 'premiumGems' - 'wbTokens' - 'infTokens'
                   - 'playerLv' - 'xp' - '_spent' - '_xpGain' - '_spentCalc'
                   - '_rebirthDo' - 'tamper';

  -- Deduplikasi stacks
  merged := public._clean_stacks(merged);

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
    'petEquipped', merged->'petEquipped',
    'artSlots', merged->'artSlots',
    'rollPacks', merged->'rollPacks',
    'weather', merged->'weather',
    'potions', merged->'potions',
    'mythicPotions', merged->'mythicPotions',
    'luckPots', merged->'luckPots',
    'speedPots', merged->'speedPots',
    'penalty', null,
    'tamper', '[]'::jsonb
  );
end;
$$;
