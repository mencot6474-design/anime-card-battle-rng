-- 0036_stacks_ledger.sql — Unit 4c: stacks ledger (anti-inject)
--
-- Tujuan: nyimpen tiap pull dari roll_pull ke roll_history, validasi stacks
-- vs history pas merge_player_state biar kartu inject dibuang.
-- deploy: apply via _tmp/apply_sql.cjs (baca _tmp/sbpat.txt)

-- 1) ROLL HISTORY
create table if not exists public.roll_history (
  id bigserial primary key,
  username text not null,
  user_id uuid,
  card_id text not null,
  mut text not null default 'none',
  shiny boolean not null default false,
  dup boolean not null default false,
  pack text,
  rolled_at timestamptz not null default now()
);

create index if not exists idx_roll_history_user on public.roll_history(user_id, rolled_at);
create index if not exists idx_roll_history_uname on public.roll_history(username, rolled_at);

alter table public.roll_history enable row level security;
revoke all on public.roll_history from anon, authenticated;
grant select, insert on public.roll_history to service_role;

-- 2) UBAH roll_pull BIAR CATAT HISTORY
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
      if r.chance * v_sm_c * coalesce(m.chance_mult,1) >= v_rare_den then
        v_w := 1.0 / (r.chance * v_sm_c * coalesce(m.chance_mult,1));
      else
        v_w := v_k / (r.chance * v_sm_c * coalesce(m.chance_mult,1));
      end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object('char',r.char_id,'tier',r.tier,'mut',m.mut,'shiny',true,'ch',r.chance*v_sm_c*coalesce(m.chance_mult,1),'w',v_w));
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
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack) values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',true,p_pack);
    else
      v_new_count := v_new_count + 1;
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text),1,9);
      v_stacks := v_stacks || jsonb_build_array(jsonb_build_object('id',v_ns_id,'char',v_pick->>'char','tier',v_pick->>'tier','fav',false,'lock',false,'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','trait','none','count',1));
      v_res := v_res || jsonb_build_array(jsonb_build_object('cardId',v_pick->>'char','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','chance',(v_pick->>'ch')::numeric,'dup',false));
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack) values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',false,p_pack);
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

-- 3) VALIDASI STACKS VS HISTORY DI merge_player_state
create or replace function public._validate_stacks_ledger(p_uname text, p_stacks jsonb)
returns jsonb
language plpgsql stable
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_s jsonb;
  v_key text;
  v_cnt_hist integer;
begin
  if p_stacks is null or jsonb_typeof(p_stacks) <> 'array' then
    return '[]'::jsonb;
  end if;
  for v_s in select jsonb_array_elements(p_stacks) loop
    v_key := (v_s->>'char') || '|' || coalesce(nullif(v_s->>'mut',''),'none') || '|' || case when (v_s->>'shiny') in ('true','1') then '1' else '0' end;
    -- hitung berapa kali pernah didapet sebagai NEW (bukan dup) dari history
    select count(*) into v_cnt_hist
    from public.roll_history
    where username = lower(p_uname)
      and card_id = (v_s->>'char')
      and mut = coalesce(nullif(v_s->>'mut',''),'none')
      and shiny = ((v_s->>'shiny') in ('true','1'))
      and dup = false;
    -- minimal harus pernah ada 1 kali kalo ada di stacks sebagai item baru
    -- tapi buat aman: kalo ga ada history sama sekali -> buang (inject)
    if v_cnt_hist < 1 then
      -- cek: maybe udah ada di awal? tapi kita mulai ledger dari 0036
      -- biar adil: kalo history kosong (belum pernah roll lewat server) -> skip enforcement dulu
      continue;
    end if;
    v_out := v_out || jsonb_build_array(v_s);
  end loop;
  return v_out;
end;
$$;

revoke all on function public._validate_stacks_ledger(text,jsonb) from public;
revoke execute on function public._validate_stacks_ledger(text,jsonb) from anon, authenticated;
