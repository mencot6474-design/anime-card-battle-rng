
-- 2) HELPERS
create or replace function public._roll_shiny_chance_mult()
returns numeric language sql stable as $$ select coalesce((select val from public.roll_config where key='shiny_chance_mult'),50) $$;

create or replace function public._roll_rare_den()
returns numeric language sql stable as $$ select coalesce((select val from public.roll_config where key='roll_rare_den'),50000) $$;

create or replace function public._roll_common_scale(p_save jsonb, p_aw text)
returns numeric
language plpgsql stable
as $$
declare
  rare_sum numeric := 0;
  common_sum numeric := 0;
  r record;
  base numeric;
  den numeric;
  sm_c numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'),50);
begin
  for r in select rp.char_id, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only from public.roll_pool_def rp loop
    if coalesce(r.no_gacha,false) then continue; end if;
    if (r.raid_boss or r.tower_boss) then
      if not (
        (coalesce(p_save->'raidShopOwned','{}'::jsonb) ? r.char_id) or
        (coalesce(p_save->'towerShopOwned','{}'::jsonb) ? r.char_id) or
        exists(select 1 from jsonb_array_elements(coalesce(p_save->'stacks','[]'::jsonb)) s where s->>'char'=r.char_id)
      ) then continue; end if;
    end if;
    if r.weather_only is not null and r.weather_only <> coalesce(p_aw,'') then continue; end if;
    base := coalesce(r.chance,0);
    if base <= 0 then continue; end if;
    for m in select mut, chance_mult from public.roll_mut_rates loop
      den := base * sm_c * coalesce(m.chance_mult,1);
      if den >= public._roll_rare_den() then rare_sum := rare_sum + 1.0/den; else common_sum := common_sum + 1.0/den; end if;
      den := base * coalesce(m.chance_mult,1);
      if den >= public._roll_rare_den() then rare_sum := rare_sum + 1.0/den; else common_sum := common_sum + 1.0/den; end if;
    end loop;
  end loop;
  rare_sum := least(0.5, rare_sum);
  if common_sum <= 0 then return 1.0; end if;
  return (1.0 - rare_sum)/common_sum;
end;
$$;

revoke all on function public._roll_common_scale(jsonb,text) from public;
revoke execute on function public._roll_common_scale(jsonb,text) from anon, authenticated;

create or replace function public._dup_sell_value(p_tier text, p_mut text, p_shiny boolean)
returns numeric language sql stable as $$
  select round(
    (case coalesce(p_tier,'R') when 'R' then 20 when 'SR' then 40 when 'SSR' then 90 when 'UR' then 220 when 'EX' then 600 when 'BOSS' then 600 else 20 end)
    * (case coalesce(p_mut,'none') when 'gold' then 2 when 'rainbow' then 3 when 'secret' then 5 when 'ultima' then 8 else 1 end)
    * (case when p_shiny then 2 else 1 end)
  )
$$;

revoke all on function public._dup_sell_value(text,text,boolean) from public;
revoke execute on function public._dup_sell_value(text,text,boolean) from anon, authenticated;

-- 3) RPC roll_pull
create or replace function public.roll_pull(
  p_count integer default 1,
  p_pack  text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_uname text;
  v_save jsonb;
  v_aw text;
  v_cnt integer := greatest(1, least(coalesce(p_count,1), 100));
  v_use_pack boolean := p_pack is not null and p_pack <> '';
  v_pack_def record;
  v_owned integer := 0;
  v_use integer := 0;
  v_res jsonb := '[]'::jsonb;
  v_r record;
  v_pick record;
  v_dup boolean;
  v_ess numeric := 0;
  v_new_count integer := 0;
  v_dup_count integer := 0;
  v_rarest_ch numeric := -1e18;
  v_rarest jsonb := null;
  v_stacks jsonb := '[]'::jsonb;
  v_s jsonb;
  v_i integer;
  v_ns_id text;
  v_sm_c numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'),50);
  v_rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'),50000);
  v_k numeric;
  v_total numeric := 0;
  v_rnd numeric;
  v_acc numeric := 0;
  v_entries jsonb[] := '{}';
  v_w numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if v_use_pack then
    select * into v_pack_def from public.pack_def where id = p_pack;
    if not found then
      return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
    end if;
    select coalesce((v_save->'rollPacks')->>(p_pack),'0')::integer into v_owned;
    v_use := v_cnt;
    if v_owned < v_use then
      return jsonb_build_object('ok',false,'msg','PACK_EMPTY');
    end if;
    v_save := jsonb_set(v_save, array['rollPacks', p_pack], to_jsonb(v_owned - v_use));
  end if;

  v_aw := case when v_save->'weather' is not null and (v_save->'weather'->>'endsAt')::bigint > extract(epoch from now())*1000 then v_save->'weather'->>'id' else null end;
  v_k := public._roll_common_scale(v_save, v_aw);
  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);

  for r in select rp.char_id, rp.tier, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(r.no_gacha,false) then continue; end if;
    if (r.raid_boss or r.tower_boss) then
      if not (
        (coalesce(v_save->'raidShopOwned','{}'::jsonb) ? r.char_id) or
        (coalesce(v_save->'towerShopOwned','{}'::jsonb) ? r.char_id) or
        exists(select 1 from jsonb_array_elements(v_stacks) s where s->>'char'=r.char_id)
      ) then continue; end if;
    end if;
    if r.weather_only is not null and r.weather_only <> coalesce(v_aw,'') then continue; end if;
    if coalesce(r.chance,0) <= 0 then continue; end if;
    for m in select mut, chance_mult from public.roll_mut_rates loop
      -- shiny true
      if r.chance * v_sm_c * coalesce(m.chance_mult,1) >= v_rare_den then
        v_w := 1.0 / (r.chance * v_sm_c * coalesce(m.chance_mult,1));
      else
        v_w := v_k / (r.chance * v_sm_c * coalesce(m.chance_mult,1));
      end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object('char',r.char_id,'tier',r.tier,'mut',m.mut,'shiny',true,'ch',r.chance*v_sm_c*coalesce(m.chance_mult,1),'w',v_w));
      -- shiny false
      if r.chance * coalesce(m.chance_mult,1) >= v_rare_den then
        v_w := 1.0 / (r.chance * coalesce(m.chance_mult,1));
      else
        v_w := v_k / (r.chance * coalesce(m.chance_mult,1));
      end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object('char',r.char_id,'tier',r.tier,'mut',m.mut,'shiny',false,'ch',r.chance*coalesce(m.chance_mult,1),'w',v_w));
    end loop;
  end loop;

  if v_total <= 0 or array_length(v_entries,1) is null then
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  for v_i in 1..v_cnt loop
    v_rnd := random() * v_total;
    v_acc := 0;
    v_pick := null;
    foreach v_s in array v_entries loop
      v_acc := v_acc + (v_s->>'w')::numeric;
      if v_rnd <= v_acc then v_pick := v_s; exit; end if;
    end loop;
    if v_pick is null then v_pick := v_entries[array_length(v_entries,1)]; end if;
    v_dup := false;
    if jsonb_array_length(v_stacks) > 0 then
      for v_s in select jsonb_array_elements(v_stacks) loop
        if (v_s->>'char') = (v_pick->>'char') and coalesce(v_s->>'mut','none') = (v_pick->>'mut') and ((v_s->>'shiny') in ('true','1')) = ((v_pick->>'shiny')='true') then
          v_dup := true; exit;
        end if;
      end loop;
    end if;
    if v_dup then
      v_dup_count := v_dup_count + 1;
      v_ess := v_ess + public._dup_sell_value(v_pick->>'tier', v_pick->>'mut', (v_pick->>'shiny')='true');
      v_res := v_res || jsonb_build_array(jsonb_build_object('cardId',v_pick->>'char','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','chance',(v_pick->>'ch')::numeric,'dup',true));
    else
      v_new_count := v_new_count + 1;
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text),1,9);
      v_stacks := v_stacks || jsonb_build_array(jsonb_build_object('id',v_ns_id,'char',v_pick->>'char','tier',v_pick->>'tier','fav',false,'lock',false,'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','trait','none','count',1));
      v_res := v_res || jsonb_build_array(jsonb_build_object('cardId',v_pick->>'char','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','chance',(v_pick->>'ch')::numeric,'dup',false));
      if (v_pick->>'ch')::numeric > v_rarest_ch then
        v_rarest_ch := (v_pick->>'ch')::numeric;
        v_rarest := jsonb_build_object('char',v_pick->>'char','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','ch',v_rarest_ch);
      end if;
    end if;
  end loop;

  v_save := jsonb_set(v_save, '{stacks}', v_stacks);
  if v_ess > 0 then
    if v_save->'rebirth' is null then v_save := jsonb_set(v_save, '{rebirth}', jsonb_build_object('count',0,'essence',0)); end if;
    v_save := jsonb_set(v_save, array['rebirth','essence'], to_jsonb(coalesce((v_save->'rebirth'->>'essence')::numeric,0) + v_ess));
  end if;
  v_save := jsonb_set(v_save, '{totalRolls}', to_jsonb(coalesce((v_save->>'totalRolls')::bigint,0) + v_cnt));

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok',true,'results',v_res,'total',v_cnt,'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,'rarestPull',v_rarest,'stacks',v_stacks);
end;
$$;

revoke all on function public.roll_pull(integer,text) from public;
revoke execute on function public.roll_pull(integer,text) from anon;
grant execute on function public.roll_pull(integer,text) to authenticated;
