-- 0045_speed_3x_pass.sql — 3x Battle Speed Pass (3,000 Gems) + Battle Speed Cap (1x-3x)
--
-- PERUBAHAN:
--   1. Battle speed x4 dihapus; x2 gratis untuk semua pemain; x3 menjadi Pass permanen
--      di Premium Shop seharga 3,000 Gems (`speed-3x`).
--   2. `item_def.kind` dan `player_items.kind` diperluas menjadi ('pet', 'art', 'pass').
--   3. Insert item pass `speed-3x` (`gem_price = 3000, src = 'gem'`).
--   4. `buy_item('speed-3x')` memotong 3,000 Gems secara atomik, mencatat ke `player_items`,
--      menulis `passesOwned` ke `save_data`, dan membalas `passesOwned`.
--   5. `merge_player_state` mengunci `passesOwned` dari `player_items` ledger server
--      (F12 tidak bisa memalsukan kepemilikan pass) dan men-clamp `battleSpeed` ke 1..3
--      (maks 2 tanpa `speed-3x`, maks 3 dengan `speed-3x`).

-- ---------- 1) EXTEND CONSTRAINTS & ITEM DEFINITION ----------
alter table public.item_def drop constraint if exists item_def_kind_check;
alter table public.item_def add constraint item_def_kind_check check (kind in ('pet', 'art', 'pass'));

alter table public.player_items drop constraint if exists player_items_kind_check;
alter table public.player_items add constraint player_items_kind_check check (kind in ('pet', 'art', 'pass'));

insert into public.item_def (id, kind, coin_price, gem_price, src) values
  ('speed-3x', 'pass', 0, 3000, 'gem')
on conflict (id) do update
  set kind = excluded.kind,
      coin_price = excluded.coin_price,
      gem_price  = excluded.gem_price,
      src        = excluded.src;

-- ---------- 2) _claim_items: izinkan kind 'pass' ----------
create or replace function public._claim_items(
  p_uname   text,
  p_claimed jsonb,
  p_kind    text,
  p_budget  bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     text;
  v_def    public.item_def%rowtype;
  v_budget bigint := greatest(0, coalesce(p_budget, 0));
  v_used   bigint := 0;
  v_kept   jsonb  := '[]'::jsonb;
  v_strip  jsonb  := '[]'::jsonb;
  v_unk    jsonb  := '[]'::jsonb;
begin
  if p_uname is null or p_kind is null or p_kind not in ('pet', 'art', 'pass') then
    return jsonb_build_object('kept', '[]'::jsonb, 'stripped', '[]'::jsonb,
                              'unknown', '[]'::jsonb, 'used', 0);
  end if;

  if p_claimed is null
     or jsonb_typeof(p_claimed) <> 'array'
     or jsonb_array_length(p_claimed) = 0 then
    return jsonb_build_object('kept', public._items_of(p_uname, p_kind),
                              'stripped', '[]'::jsonb,
                              'unknown', '[]'::jsonb, 'used', 0);
  end if;

  for v_id in
    select q.id
      from (
        select distinct on (e.v #>> '{}') e.v #>> '{}' as id, e.ord
          from jsonb_array_elements(
                 case when jsonb_typeof(p_claimed) = 'array'
                      then p_claimed else '[]'::jsonb end)
               with ordinality as e(v, ord)
         where jsonb_typeof(e.v) = 'string'
           and length(e.v #>> '{}') <= 64
         order by e.v #>> '{}', e.ord
      ) q
     order by q.ord
     limit 200
  loop
    select * into v_def from public.item_def where id = v_id and kind = p_kind;
    if not found then
      v_unk := v_unk || to_jsonb(v_id);
      continue;
    end if;

    if exists (select 1 from public.player_items pi
                where pi.username = p_uname and pi.item_id = v_id) then
      v_kept := v_kept || to_jsonb(v_id);
      continue;
    end if;

    if v_def.src = 'tower' then
      insert into public.player_items (username, item_id, kind, source, paid)
      values (p_uname, v_id, p_kind, 'tower', 0)
      on conflict do nothing;
      v_kept := v_kept || to_jsonb(v_id);
    elsif v_def.src = 'coin' and v_def.coin_price > 0 and v_def.coin_price <= v_budget then
      insert into public.player_items (username, item_id, kind, source, paid)
      values (p_uname, v_id, p_kind, 'coin', v_def.coin_price)
      on conflict do nothing;
      v_budget := v_budget - v_def.coin_price;
      v_used   := v_used + v_def.coin_price;
      v_kept   := v_kept || to_jsonb(v_id);
    else
      v_strip := v_strip || to_jsonb(v_id);
    end if;
  end loop;

  return jsonb_build_object('kept', v_kept, 'stripped', v_strip,
                            'unknown', v_unk, 'used', v_used);
end;
$$;

-- ---------- 3) buy_item: kembalikan & sinkronkan passesOwned ----------
create or replace function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_def   public.item_def%rowtype;
  v_bal   bigint;
  v_gems  integer;
  v_pass  jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select username into v_uname from public.player_saves where user_id = v_uid limit 1;
  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  select * into v_def from public.item_def where id = p_item_id;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'BAD_ITEM');
  end if;
  if v_def.src not in ('coin', 'gem') then
    return jsonb_build_object('ok', false, 'msg', 'NOT_SOLD_HERE', 'src', v_def.src);
  end if;

  if exists (select 1 from public.player_items
              where username = v_uname and item_id = p_item_id) then
    select public._coins_of(save_data), public._int_of(save_data, 'premiumGems', 0)
      into v_bal, v_gems
      from public.player_saves where user_id = v_uid;
    return jsonb_build_object('ok', true, 'already', true, 'item_id', p_item_id,
      'kind', v_def.kind, 'coins_balance', coalesce(v_bal, 0),
      'premiumGems', coalesce(v_gems, 0),
      'petOwned', public._items_of(v_uname, 'pet'),
      'artOwned', public._items_of(v_uname, 'art'),
      'passesOwned', public._items_of(v_uname, 'pass'));
  end if;

  if v_def.coin_price > 0 then
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{coins}',
             to_jsonb(public._coins_of(coalesce(save_data, '{}'::jsonb)) - v_def.coin_price), true),
           updated_at = now()
     where user_id = v_uid
       and public._coins_of(coalesce(save_data, '{}'::jsonb)) >= v_def.coin_price
     returning public._coins_of(save_data) into v_bal;
    if v_bal is null then
      select public._coins_of(save_data) into v_bal
        from public.player_saves where user_id = v_uid;
      return jsonb_build_object('ok', false, 'msg', 'COIN_KURANG',
                                'coins_balance', coalesce(v_bal, 0), 'cost', v_def.coin_price);
    end if;
  else
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
             to_jsonb(public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) - v_def.gem_price), true),
           updated_at = now()
     where user_id = v_uid
       and public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) >= v_def.gem_price
     returning public._int_of(save_data, 'premiumGems', 0) into v_gems;
    if v_gems is null then
      select public._int_of(save_data, 'premiumGems', 0) into v_gems
        from public.player_saves where user_id = v_uid;
      return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                                'premiumGems', coalesce(v_gems, 0), 'cost', v_def.gem_price);
    end if;
  end if;

  insert into public.player_items (username, item_id, kind, source, paid)
  values (v_uname, p_item_id, v_def.kind,
          case when v_def.coin_price > 0 then 'coin' else 'gem' end,
          greatest(v_def.coin_price, v_def.gem_price))
  on conflict do nothing;

  v_pass := public._items_of(v_uname, 'pass');
  if v_def.kind = 'pass' then
    update public.player_saves
       set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{passesOwned}', v_pass, true),
           updated_at = now()
     where user_id = v_uid;
  end if;

  select public._coins_of(save_data), public._int_of(save_data, 'premiumGems', 0)
    into v_bal, v_gems
    from public.player_saves where user_id = v_uid;

  return jsonb_build_object('ok', true, 'item_id', p_item_id, 'kind', v_def.kind,
    'coins_balance', coalesce(v_bal, 0), 'premiumGems', coalesce(v_gems, 0),
    'petOwned', public._items_of(v_uname, 'pet'),
    'artOwned', public._items_of(v_uname, 'art'),
    'passesOwned', v_pass);
end;
$$;

-- ---------- 4) spend_gems: dukung passesOwned di fallback ----------
create or replace function public.spend_gems(
  p_cost integer,
  p_allow_gem_decrease boolean default false,
  p_save_data jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_uname text;
  v_gems  integer;
  v_res   jsonb;
  v_delta_cost integer := 0;
  v_rec   record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_cost is null or p_cost < 0 then
    raise exception 'BAD_INPUT';
  end if;

  select username, public._int_of(save_data, 'premiumGems', 0)
    into v_uname, v_gems
    from public.player_saves
   where user_id = v_uid
   limit 1
   for update;

  if v_uname is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;
  if v_gems < p_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', v_gems, 'cost', p_cost);
  end if;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
           to_jsonb(v_gems - p_cost), true),
         updated_at = now()
   where user_id = v_uid;

  insert into public.player_items (username, item_id, kind, source, paid)
  select v_uname, d.id, d.kind, 'gem', d.gem_price
    from public.item_def d
   where d.src = 'gem'
     and d.gem_price > 0
     and d.gem_price <= p_cost
     and (
       exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(coalesce(p_save_data, '{}'::jsonb)->'petOwned') = 'array'
                then p_save_data->'petOwned' else '[]'::jsonb end) as e(v)
          where e.v #>> '{}' = d.id)
       or exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(coalesce(p_save_data, '{}'::jsonb)->'artOwned') = 'array'
                then p_save_data->'artOwned' else '[]'::jsonb end) as e(v)
          where e.v #>> '{}' = d.id)
       or exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(coalesce(p_save_data, '{}'::jsonb)->'passesOwned') = 'array'
                then p_save_data->'passesOwned' else '[]'::jsonb end) as e(v)
          where e.v #>> '{}' = d.id)
     )
  on conflict do nothing;

  for v_rec in
    select d.id, d.gems,
           greatest(0,
             case when coalesce(p_save_data->'rollPacks'->>d.id, '') ~ '^[0-9]{1,9}$'
                  then (p_save_data->'rollPacks'->>d.id)::integer else 0 end
             - coalesce(pp.qty, 0)) as dq
      from public.pack_def d
      left join public.player_packs pp
        on pp.username = v_uname and pp.pack = d.id
  loop
    if v_rec.dq > 0 then
      v_delta_cost := v_delta_cost + v_rec.dq * v_rec.gems;
    end if;
  end loop;

  if v_delta_cost > 0 and v_delta_cost = p_cost then
    for v_rec in
      select d.id,
             greatest(0,
               case when coalesce(p_save_data->'rollPacks'->>d.id, '') ~ '^[0-9]{1,9}$'
                    then (p_save_data->'rollPacks'->>d.id)::integer else 0 end
               - coalesce(pp.qty, 0)) as dq
        from public.pack_def d
        left join public.player_packs pp
          on pp.username = v_uname and pp.pack = d.id
    loop
      if v_rec.dq > 0 then
        insert into public.player_packs (username, pack, qty)
        values (v_uname, v_rec.id, v_rec.dq)
        on conflict (username, pack) do update
          set qty = public.player_packs.qty + excluded.qty;
      end if;
    end loop;
  end if;

  if p_save_data is not null and jsonb_typeof(p_save_data) = 'object' and p_save_data <> '{}'::jsonb then
    v_res := public.merge_player_state(p_save_data, false, not (p_save_data ? 'stacks'));
    if v_res is null or coalesce((v_res->>'ok')::boolean, false) is not true then
      update public.player_saves
         set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
               to_jsonb(public._int_of(coalesce(save_data, '{}'::jsonb), 'premiumGems', 0) + p_cost), true),
             updated_at = now()
       where user_id = v_uid;
      return coalesce(v_res, jsonb_build_object('ok', false, 'msg', 'MERGE_FAIL'));
    end if;
    return jsonb_build_object('ok', true,
      'balance', coalesce((v_res->>'premiumGems')::integer, v_gems - p_cost),
      'cost', p_cost,
      'weather', coalesce(v_res->'weather', 'null'::jsonb),
      'rollPacks', coalesce(v_res->'rollPacks', '{}'::jsonb),
      'passesOwned', coalesce(v_res->'passesOwned', '[]'::jsonb));
  end if;

  return jsonb_build_object('ok', true,
    'balance', v_gems - p_cost,
    'cost', p_cost,
    'passesOwned', public._items_of(v_uname, 'pass'));
end;
$$;

-- ---------- 5) merge_player_state: kunci passesOwned & clamp battleSpeed ----------
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
  merged := jsonb_set(merged, '{stacks}', public._clean_stacks(merged->'stacks'), true);

  merged := jsonb_set(merged, '{stacks}',
                      public._validate_stacks_ledger(uname, merged->'stacks'), true);
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
    'penalty', null,
    'tamper', '[]'::jsonb
  );
end;
$$;

-- ---------- 6) _fresh_save & register_player: sertakan passesOwned ----------
create or replace function public._fresh_save()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'coins', 1000,
    'premiumGems', 50,
    'wbTokens', 0,
    'infTokens', 0,
    'playerLv', 1,
    'xp', 0,
    'dailyIndex', 0,
    'lastClaim', '',
    'summons', 0,
    'totalRolls', 0,
    'playSec', 0,
    'muted', false,
    'diff', 'normal',
    'chap', 1,
    'raidDiff', 'normal',
    'raidCleared', jsonb_build_object('normal', false, 'hard', false,
                                      'extreme', false, 'nightmare', false),
    'raidShopOwned', '{}'::jsonb,
    'towerShopOwned', '{}'::jsonb,
    'storyGemMilestones', '{}'::jsonb,
    'dailyGemPending', 0,
    'storyCd', '{}'::jsonb,
    'rebirth', jsonb_build_object('count', 0, 'essence', 0),
    'tower', jsonb_build_object('best', 0, 'auto', false),
    'battleSpeed', 1,
    'cleared', '{}'::jsonb,
    'clearedDiff', jsonb_build_object('normal', '{}'::jsonb, 'hard', '{}'::jsonb,
                                      'extreme', '{}'::jsonb, 'nightmare', '{}'::jsonb),
    'equippedId', 'reset',
    'equippedId2', null,
    'deck', jsonb_build_array('reset', null, null, null),
    'stacks', jsonb_build_array(jsonb_build_object(
      'id', 'reset', 'char', 'CH_UNSTOPPABLE_FIST', 'tier', 'R', 'fav', false,
      'lock', false, 'mut', 'none', 'shiny', false, 'trait', 'none', 'count', 1)),
    'history', '[]'::jsonb,
    'battle', 'null'::jsonb,
    'player', jsonb_build_object('luckBase', 1, 'luckFlat', 0, 'luckPercent', 0,
                                 'exp', 0, 'lv', 1, 'sp', 0, 'tree', '{}'::jsonb),
    'weather', 'null'::jsonb,
    'weatherBest', 'null'::jsonb,
    'potions', 0,
    'mythicPotions', 0,
    'luckPots', jsonb_build_array(0, 0, 0),
    'speedPots', jsonb_build_array(0, 0, 0),
    'luckBuffs', '[]'::jsonb,
    'speedBuffs', '[]'::jsonb,
    'artOwned', '[]'::jsonb,
    'artSlots', jsonb_build_array(null, null),
    'petOwned', '[]'::jsonb,
    'petEquipped', 'null'::jsonb,
    'passesOwned', '[]'::jsonb,
    'intanRolls', 0,
    'idxRewardsClaimed', 0,
    'rollPacks', jsonb_build_object('r5k', 0, 'r10k', 0, 'r25k', 0,
                                    'r50k', 0, 'r100k', 0));
$$;

create or replace function public.register_player(p_username text, p_save_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  u       text;
  v_taken boolean;
  v_mine  text;
  v_save  jsonb;
  v_stacks jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_username is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  select username into v_mine from public.player_saves where user_id = v_uid limit 1;
  if v_mine is not null then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', v_mine);
  end if;

  select exists (select 1 from public.player_saves where username = u) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', u);
  end if;

  v_save := coalesce(p_save_data, '{}'::jsonb);
  v_save := jsonb_set(v_save, '{coins}',       to_jsonb(1000), true);
  v_save := jsonb_set(v_save, '{premiumGems}', to_jsonb(50),   true);
  v_save := jsonb_set(v_save, '{wbTokens}',    to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{infTokens}',   to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{playerLv}',    to_jsonb(1),    true);
  v_save := jsonb_set(v_save, '{xp}',          to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{rebirth}',     '{"count":0,"essence":0}'::jsonb, true);

  v_stacks := public._clean_stacks(v_save->'stacks');
  v_save := jsonb_set(v_save, '{stacks}', v_stacks, true);
  v_save := jsonb_set(v_save, '{deck}', public._clean_deck(v_save->'deck', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId}',  public._clean_equip(v_save->>'equippedId', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId2}', public._clean_equip(v_save->>'equippedId2', v_stacks), true);
  v_save := jsonb_set(v_save, '{petOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{artOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{passesOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{battleSpeed}', to_jsonb(greatest(1, least(2, public._int_of(v_save, 'battleSpeed', 1)))), true);
  v_save := jsonb_set(v_save, '{petEquipped}', 'null'::jsonb, true);
  v_save := jsonb_set(v_save, '{artSlots}', '[null,null]'::jsonb, true);

  v_save := jsonb_set(v_save, '{player}',
    (case when jsonb_typeof(v_save->'player') = 'object'
          then v_save->'player' else '{}'::jsonb end)
      || jsonb_build_object('lv', 1, 'exp', 0, 'sp', 0, 'tree', '{}'::jsonb,
                            'luckBase', 1, 'luckFlat', 0, 'luckPercent', 0), true);
  v_save := v_save - '_coinSpend' - '_xpGain' - '_rebirthGain' - '_rebirthDo';

  insert into public.player_saves (username, save_data, user_id)
  values (u, v_save, v_uid);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

create or replace function public.register_player(p_username text, p_save_data jsonb, p_password_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  u       text;
  v_taken boolean;
  v_mine  text;
  v_save  jsonb;
  v_stacks jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_username is null or p_save_data is null then
    return jsonb_build_object('ok', false, 'msg', 'BAD_INPUT');
  end if;
  u := lower(btrim(p_username));
  if u = '' or length(u) > 32 then
    return jsonb_build_object('ok', false, 'msg', 'NAMA_TIDAK_VALID');
  end if;

  select username into v_mine from public.player_saves where user_id = v_uid limit 1;
  if v_mine is not null then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', v_mine);
  end if;

  select exists (select 1 from public.player_saves where username = u) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', true, 'created', false, 'msg', 'TAKEN', 'username', u);
  end if;

  v_save := coalesce(p_save_data, '{}'::jsonb);
  v_save := jsonb_set(v_save, '{coins}',       to_jsonb(1000), true);
  v_save := jsonb_set(v_save, '{premiumGems}', to_jsonb(50),   true);
  v_save := jsonb_set(v_save, '{wbTokens}',    to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{infTokens}',   to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{playerLv}',    to_jsonb(1),    true);
  v_save := jsonb_set(v_save, '{xp}',          to_jsonb(0),    true);
  v_save := jsonb_set(v_save, '{rebirth}',     '{"count":0,"essence":0}'::jsonb, true);

  v_stacks := public._clean_stacks(v_save->'stacks');
  v_save := jsonb_set(v_save, '{stacks}', v_stacks, true);
  v_save := jsonb_set(v_save, '{deck}', public._clean_deck(v_save->'deck', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId}',  public._clean_equip(v_save->>'equippedId', v_stacks), true);
  v_save := jsonb_set(v_save, '{equippedId2}', public._clean_equip(v_save->>'equippedId2', v_stacks), true);
  v_save := jsonb_set(v_save, '{petOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{artOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{passesOwned}', '[]'::jsonb, true);
  v_save := jsonb_set(v_save, '{battleSpeed}', to_jsonb(greatest(1, least(2, public._int_of(v_save, 'battleSpeed', 1)))), true);
  v_save := jsonb_set(v_save, '{petEquipped}', 'null'::jsonb, true);
  v_save := jsonb_set(v_save, '{artSlots}', '[null,null]'::jsonb, true);

  v_save := jsonb_set(v_save, '{player}',
    (case when jsonb_typeof(v_save->'player') = 'object'
          then v_save->'player' else '{}'::jsonb end)
      || jsonb_build_object('lv', 1, 'exp', 0, 'sp', 0, 'tree', '{}'::jsonb,
                            'luckBase', 1, 'luckFlat', 0, 'luckPercent', 0), true);
  v_save := v_save - '_coinSpend' - '_xpGain' - '_rebirthGain' - '_rebirthDo';

  insert into public.player_saves (username, password, save_data, user_id)
  values (u, p_password_hash, v_save, v_uid);

  return jsonb_build_object('ok', true, 'created', true, 'username', u);
end;
$$;

-- ---------- 7) ACL ----------
revoke all on function public._claim_items(text, jsonb, text, bigint) from public, anon, authenticated;
grant execute on function public._claim_items(text, jsonb, text, bigint) to service_role;

revoke all on function public._fresh_save() from public, anon, authenticated;
grant execute on function public._fresh_save() to service_role;

revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated, service_role;

revoke all on function public.spend_gems(integer, boolean, jsonb) from public, anon;
grant execute on function public.spend_gems(integer, boolean, jsonb) to authenticated, service_role;

revoke all on function public.merge_player_state(jsonb, boolean, boolean) from public, anon;
grant execute on function public.merge_player_state(jsonb, boolean, boolean) to authenticated, service_role;

revoke all on function public.register_player(text, jsonb) from public, anon;
grant execute on function public.register_player(text, jsonb) to authenticated, service_role;

revoke all on function public.register_player(text, jsonb, text) from public, anon;
grant execute on function public.register_player(text, jsonb, text) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
