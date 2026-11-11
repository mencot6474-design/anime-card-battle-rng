-- 0046_luck_shiny_passes.sql — Pass Luck 2x/4x & Shiny Chance 2x/4x (Stackable Tanpa Batas)
--
-- Tujuan:
--   1. Menambahkan 4 pass permanen baru ke `public.item_def` (`kind = 'pass'`, `src = 'gem'`):
--        * `luck-2x`  : 5,000 Gems -> 2× Total Luck
--        * `luck-4x`  : 10,000 Gems -> 4× Total Luck (Booster)
--        * `shiny-2x` : 4,000 Gems -> 2× Shiny Chance
--        * `shiny-4x` : 8,000 Gems -> 4× Shiny Chance (Booster)
--   2. Tabel metadata `public.pass_def` sebagai sumber otoritatif multiplier pass di server.
--   3. Stacking perkalian penuh tanpa batas slot/cap:
--        * _pass_luck_mult(v_uname)  -> 1× / 2× / 4× / 8× (dikali ke _luck_of -> basis server)
--        * _pass_shiny_mult(v_uname) -> 1× / 2× / 4× / 8× (mengalikan bobot shiny di _roll_entries)
--      Karena _pass_luck_mult masuk ke `v_l_srv = _luck_of(v_save, v_uname)`, buff pass tidak
--      terpotong `luck_allow_cap` dan tetap menumpuk dengan semua buff lain.
--   4. `_roll_entries` menjaga `v_ch` kanonik agar threshold `roll_rare_den = 50000`,
--      kompensasi duplikat (`_dup_sell_value`), dan skor `rarest_pull` tidak menyusut.

-- ---------- 1) METADATA PASS ----------
create table if not exists public.pass_def (
  id         text primary key,
  kind       text not null check (kind in ('speed', 'luck', 'shiny')),
  luck_mult  numeric not null default 1 check (luck_mult >= 1),
  shiny_mult numeric not null default 1 check (shiny_mult >= 1),
  max_speed  integer not null default 2 check (max_speed >= 2)
);

alter table public.pass_def enable row level security;
revoke all on table public.pass_def from anon, authenticated;
grant select on table public.pass_def to service_role;

insert into public.pass_def (id, kind, luck_mult, shiny_mult, max_speed) values
  ('speed-3x',  'speed', 1, 1, 3),
  ('luck-2x',   'luck',  2, 1, 2),
  ('luck-4x',   'luck',  4, 1, 2),
  ('shiny-2x',  'shiny', 1, 2, 2),
  ('shiny-4x',  'shiny', 1, 4, 2)
on conflict (id) do update
  set kind       = excluded.kind,
      luck_mult  = excluded.luck_mult,
      shiny_mult = excluded.shiny_mult,
      max_speed  = excluded.max_speed;

-- ---------- 2) DAFTARKAN KE item_def (dipakai buy_item & spend_gems 0045) ----------
insert into public.item_def (id, kind, coin_price, gem_price, src) values
  ('luck-2x',  'pass', 0,  5000, 'gem'),
  ('luck-4x',  'pass', 0, 10000, 'gem'),
  ('shiny-2x', 'pass', 0,  4000, 'gem'),
  ('shiny-4x', 'pass', 0,  8000, 'gem')
on conflict (id) do update
  set kind       = excluded.kind,
      coin_price = excluded.coin_price,
      gem_price  = excluded.gem_price,
      src        = excluded.src;

-- ---------- 3) HELPER MULTIPLIER PASS (DARI LEDGER player_items) ----------
create or replace function public._pass_luck_mult(p_uname text)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_mult numeric := 1;
  v_one  numeric;
begin
  if p_uname is null or p_uname = '' then
    return 1;
  end if;
  for v_one in
    select pd.luck_mult
      from public.player_items pi
      join public.pass_def pd on pd.id = pi.item_id
     where pi.username = p_uname
       and pi.kind = 'pass'
       and pd.luck_mult > 1
  loop
    v_mult := v_mult * v_one;
  end loop;
  return greatest(1, v_mult);
end;
$$;

create or replace function public._pass_shiny_mult(p_uname text)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_mult numeric := 1;
  v_one  numeric;
begin
  if p_uname is null or p_uname = '' then
    return 1;
  end if;
  for v_one in
    select pd.shiny_mult
      from public.player_items pi
      join public.pass_def pd on pd.id = pi.item_id
     where pi.username = p_uname
       and pi.kind = 'pass'
       and pd.shiny_mult > 1
  loop
    v_mult := v_mult * v_one;
  end loop;
  return greatest(1, v_mult);
end;
$$;

-- ---------- 4) UPDATE _luck_of, _roll_common_scale, _roll_entries ----------
drop function if exists public._luck_of(jsonb);
create or replace function public._luck_of(p_save jsonb, p_uname text default null)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_player jsonb := coalesce(p_save->'player','{}'::jsonb);
  v_tree   jsonb := coalesce(p_save->'player','{}'::jsonb)->'tree';
  v_base   numeric := coalesce((v_player->>'luckBase')::numeric, (v_player->>'luck')::numeric, 1);
  v_flat   numeric := coalesce((v_player->>'luckFlat')::numeric, 0);
  v_pct    numeric := coalesce((v_player->>'luckPercent')::numeric, 0);
  v_tf     numeric; v_tp numeric;
  v_af     numeric; v_ap numeric;
  v_pf     numeric; v_pp numeric;
  v_aw     text;
  v_wmult  numeric := 1;
  v_gmult  numeric := 1;
  v_rmult  numeric := 1;
  v_pmult  numeric := 1;
begin
  select coalesce(sum(flat),0), coalesce(sum(pct),0) into v_tf, v_tp
    from public.luck_def
   where kind='tree' and coalesce((v_tree->>id) in ('true','1'), false);
  v_flat := v_flat + v_tf; v_pct := v_pct + v_tp;

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_af, v_ap
    from jsonb_array_elements_text(coalesce(p_save->'artSlots','[]'::jsonb)) as slot_id
    join public.luck_def ld on ld.kind='art' and ld.id = slot_id
   where slot_id is not null;
  v_flat := v_flat + coalesce(v_af,0); v_pct := v_pct + coalesce(v_ap,0);

  select coalesce(sum(ld.flat),0), coalesce(sum(ld.pct),0) into v_pf, v_pp
    from public.luck_def ld
   where ld.kind='pet' and ld.id = nullif(p_save->>'petEquipped','');
  v_flat := v_flat + coalesce(v_pf,0); v_pct := v_pct + coalesce(v_pp,0);

  if v_pct < -0.99 then v_pct := -0.99; end if;

  if p_save->'weather' is not null
     and coalesce((p_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint then
    v_aw := p_save->'weather'->>'id';
    select coalesce(mult,1) into v_wmult from public.luck_def where kind='weather' and id = v_aw;
    v_wmult := coalesce(v_wmult,1);
  end if;

  select coalesce(multiplier,1) into v_gmult
    from public.global_luck where ends_at > now() order by ends_at desc limit 1;
  v_gmult := coalesce(v_gmult,1);

  v_rmult := 1 + greatest(0, coalesce((p_save->'rebirth'->>'count')::integer, 0));
  v_pmult := public._pass_luck_mult(p_uname);

  return greatest(1, (v_base + v_flat) * (1 + v_pct) * v_wmult * v_gmult * v_rmult * v_pmult);
end;
$$;

drop function if exists public._roll_common_scale(jsonb, text);
create or replace function public._roll_common_scale(
  p_save       jsonb,
  p_aw         text,
  p_shiny_mult numeric default 1
)
returns numeric
language plpgsql stable security definer
set search_path = public
as $$
declare
  rare_sum   numeric := 0;
  common_sum numeric := 0;
  v_r        record;
  v_m        record;
  base       numeric;
  den        numeric;
  sm_c       numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'),50);
  rare_den   numeric := coalesce((select val from public.roll_config where key='roll_rare_den'),50000);
  v_s_mult   numeric := greatest(1, coalesce(p_shiny_mult, 1));
begin
  for v_r in select rp.char_id, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
             from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(v_r.no_gacha,false) then continue; end if;
    if (v_r.raid_boss or v_r.tower_boss) then
      if not (
        (coalesce(p_save->'raidShopOwned','{}'::jsonb) ? v_r.char_id) or
        (coalesce(p_save->'towerShopOwned','{}'::jsonb) ? v_r.char_id) or
        exists(select 1 from jsonb_array_elements(coalesce(p_save->'stacks','[]'::jsonb)) s where s->>'char'=v_r.char_id)
      ) then continue; end if;
    end if;
    if v_r.weather_only is not null and v_r.weather_only <> coalesce(p_aw,'') then continue; end if;
    base := coalesce(v_r.chance,0);
    if base <= 0 then continue; end if;
    for v_m in select mut, chance_mult from public.roll_mut_rates order by ord loop
      den := base * sm_c * coalesce(v_m.chance_mult,1);
      if den >= rare_den then rare_sum := rare_sum + (v_s_mult / den);
      else common_sum := common_sum + (v_s_mult / den); end if;

      den := base * coalesce(v_m.chance_mult,1);
      if den >= rare_den then rare_sum := rare_sum + (1.0 / den);
      else common_sum := common_sum + (1.0 / den); end if;
    end loop;
  end loop;
  rare_sum := least(0.5, rare_sum);
  if common_sum <= 0 then return 1.0; end if;
  return (1.0 - rare_sum)/common_sum;
end;
$$;

drop function if exists public._roll_entries(jsonb, text, numeric);
create or replace function public._roll_entries(
  p_save       jsonb,
  p_aw         text,
  p_l          numeric,
  p_shiny_mult numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_entries  jsonb[] := '{}';
  v_total    numeric := 0;
  v_k        numeric;
  v_ch       numeric;
  v_w        numeric;
  v_r        record;
  v_m        record;
  v_sm_c     numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'), 50);
  v_rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'), 50000);
  v_s_mult   numeric := greatest(1, coalesce(p_shiny_mult, 1));
begin
  v_k := public._roll_common_scale(p_save, p_aw, v_s_mult);

  for v_r in select rp.char_id, rp.tier, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
             from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(v_r.no_gacha,false) then continue; end if;
    if (v_r.raid_boss or v_r.tower_boss) then
      if not (
        (coalesce(p_save->'raidShopOwned','{}'::jsonb) ? v_r.char_id) or
        (coalesce(p_save->'towerShopOwned','{}'::jsonb) ? v_r.char_id) or
        exists(select 1 from jsonb_array_elements(coalesce(p_save->'stacks','[]'::jsonb)) s where s->>'char'=v_r.char_id)
      ) then continue; end if;
    end if;
    if v_r.weather_only is not null and v_r.weather_only <> coalesce(p_aw,'') then continue; end if;
    if coalesce(v_r.chance,0) <= 0 then continue; end if;
    for v_m in select m.mut, m.chance_mult from public.roll_mut_rates m order by m.ord loop
      /* shiny = true: v_ch tetap kanonik; bobot shiny dikali v_s_mult */
      v_ch := v_r.chance * v_sm_c * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := (p_l / v_ch) * v_s_mult; else v_w := (v_k / v_ch) * v_s_mult; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',true,'ch',v_ch,'bc',v_r.chance,'w',v_w));
      /* shiny = false */
      v_ch := v_r.chance * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := p_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',false,'ch',v_ch,'bc',v_r.chance,'w',v_w));
    end loop;
  end loop;

  return jsonb_build_object('total', v_total, 'entries', coalesce(to_jsonb(v_entries), '[]'::jsonb));
end;
$fn$;

-- ---------- 5) UPDATE bulk_roll & roll_pull ----------
create or replace function public.bulk_roll(
  p_pack text,
  p_qty  integer default 1,
  p_luck numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid       uuid := auth.uid();
  v_uname     text;
  v_save      jsonb;
  v_aw        text;
  v_pulls_one integer;
  v_req       integer := greatest(1, least(coalesce(p_qty,1), 50));
  v_max       integer := coalesce((select val from public.roll_config where key='bulk_max_packs'), 10)::integer;
  v_owned     integer := 0;
  v_use       integer := 0;
  v_pulls     bigint  := 0;
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
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if p_pack is null or p_pack = '' then
    return jsonb_build_object('ok',false,'msg','BAD_PACK');
  end if;

  select pulls into v_pulls_one from public.pack_def where id = p_pack;
  if v_pulls_one is null or v_pulls_one <= 0 then
    return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
  end if;

  select coalesce(qty,0) into v_owned
    from public.player_packs where username = v_uname and pack = p_pack for update;
  v_owned := coalesce(v_owned, 0);
  if v_owned <= 0 then
    return jsonb_build_object('ok',false,'msg','PACK_EMPTY','owned',0,
                              'rollPacks', public._packs_of(v_uname));
  end if;

  v_use   := least(v_req, v_owned, v_max);
  v_pulls := v_pulls_one::bigint * v_use;

  update public.player_packs set qty = qty - v_use
   where username = v_uname and pack = p_pack;

  v_aw := case when v_save->'weather' is not null
                and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
           then v_save->'weather'->>'id' else null end;

  v_l_srv  := public._luck_of(v_save, v_uname);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_s_mult := public._pass_shiny_mult(v_uname);
  v_e      := public._roll_entries(v_save, v_aw, v_l, v_s_mult);
  v_wtot   := coalesce((v_e->>'total')::numeric, 0);
  v_wrem   := v_wtot;

  if v_wtot <= 0 or jsonb_typeof(v_e->'entries') <> 'array'
                  or jsonb_array_length(v_e->'entries') = 0 then
    update public.player_packs set qty = qty + v_use
     where username = v_uname and pack = p_pack;
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL','owned',(select coalesce(qty,0) from public.player_packs where username = v_uname and pack = p_pack));
  end if;

  select coalesce(array_agg(e order by (e->>'w')::numeric asc), '{}') into v_entries
    from jsonb_array_elements(v_e->'entries') e;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) into v_have
    from (select distinct (s->>'char') || '|' ||
                 coalesce(nullif(s->>'mut',''), 'none') || '|' ||
                 case when coalesce(s->>'shiny','false') in ('true','1') then '1' else '0' end as k
          from jsonb_array_elements(v_stacks) s) t;

  v_rem := v_pulls;
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
    select v_uname, v_uid, p_pack, t->>'char', t->>'mut', (t->>'shiny') = 'true',
           (t->>'dup') = 'true', (t->>'n')::integer
      from jsonb_array_elements(v_led) t
    on conflict (username, pack, card_id, mut, shiny, dup)
      do update set n = public.roll_ledger.n + excluded.n,
                    last_at = now(),
                    user_id = coalesce(excluded.user_id, public.roll_ledger.user_id);
  end if;

  v_save := jsonb_set(v_save, '{stacks}', v_stacks);
  if v_ess > 0 then
    if v_save->'rebirth' is null then v_save := jsonb_set(v_save, '{rebirth}', jsonb_build_object('count',0,'essence',0)); end if;
    v_save := jsonb_set(v_save, array['rebirth','essence'], to_jsonb(coalesce((v_save->'rebirth'->>'essence')::numeric,0) + v_ess));
  end if;
  v_save := jsonb_set(v_save, '{totalRolls}', to_jsonb(coalesce((v_save->>'totalRolls')::bigint,0) + v_pulls));
  v_save := jsonb_set(v_save, '{rollPacks}', public._packs_of(v_uname), true);

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok',true,'used',v_use,'total',v_pulls,
    'results',v_res,'newStacks',v_new,'rollPacks',public._packs_of(v_uname),
    'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,
    'rarestPull',v_rarest,'luck',v_l,'luckServer',v_l_srv,'shinyMult',v_s_mult);
end;
$fn$;

create or replace function public.roll_pull(
  p_count integer default 1,
  p_pack  text    default null,
  p_luck  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_save    jsonb;
  v_aw      text;
  v_cnt     integer := greatest(1, least(coalesce(p_count,1), 100));
  v_use_pack boolean := p_pack is not null and p_pack <> '';
  v_owned   integer := 0;
  v_use     integer := 0;
  v_res     jsonb := '[]'::jsonb;
  v_pick    jsonb;
  v_dup     boolean;
  v_ess     numeric := 0;
  v_new_count integer := 0;
  v_dup_count integer := 0;
  v_rarest_ch numeric := -1e18;
  v_rarest  jsonb := NULL;
  v_stacks  jsonb := '[]'::jsonb;
  v_new     jsonb := '[]'::jsonb;
  v_ns      jsonb;
  v_s       jsonb;
  v_i       integer;
  v_ns_id   text;
  v_eff     numeric;
  v_l       numeric;
  v_l_srv   numeric;
  v_s_mult  numeric := 1;
  v_total   numeric := 0;
  v_rnd     numeric;
  v_acc     numeric := 0;
  v_entries jsonb[] := '{}';
  v_e       jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'msg','AUTH_REQUIRED');
  end if;

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  if v_use_pack then
    if not exists (select 1 from public.pack_def where id = p_pack) then
      return jsonb_build_object('ok',false,'msg','PACK_UNKNOWN');
    end if;
    select coalesce(qty,0) into v_owned
      from public.player_packs where username = v_uname and pack = p_pack for update;
    v_owned := coalesce(v_owned, 0);
    v_use := v_cnt;
    if v_owned < v_use then
      return jsonb_build_object('ok',false,'msg','PACK_EMPTY','owned',v_owned);
    end if;
    update public.player_packs set qty = qty - v_use
     where username = v_uname and pack = p_pack;
    v_save := jsonb_set(v_save, '{rollPacks}', public._packs_of(v_uname), true);
  end if;

  v_aw := case when v_save->'weather' is not null
               and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
          then v_save->'weather'->>'id' else null end;

  v_l_srv  := public._luck_of(v_save, v_uname);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_s_mult := public._pass_shiny_mult(v_uname);
  v_e := public._roll_entries(v_save, v_aw, v_l, v_s_mult);
  v_total := coalesce((v_e->>'total')::numeric, 0);
  select coalesce(array_agg(e), '{}') into v_entries from jsonb_array_elements(v_e->'entries') e;

  if v_total <= 0 or array_length(v_entries,1) is null then
    if v_use_pack and v_use > 0 then
      update public.player_packs set qty = qty + v_use where username = v_uname and pack = p_pack;
    end if;
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);

  for v_i in 1..v_cnt loop
    v_rnd := random() * v_total;
    v_acc := 0;
    v_pick := NULL;
    foreach v_s in array v_entries loop
      v_acc := v_acc + (v_s->>'w')::numeric;
      if v_rnd <= v_acc then v_pick := v_s; exit; end if;
    end loop;
    if v_pick is NULL then v_pick := v_entries[array_length(v_entries,1)]; end if;
    v_dup := false;
    for v_s in select jsonb_array_elements(v_stacks) loop
      if (v_s->>'char') = (v_pick->>'char')
         and coalesce(nullif(v_s->>'mut',''),'none') = (v_pick->>'mut')
         and ((v_s->>'shiny') in ('true','1')) = ((v_pick->>'shiny')='true') then
        v_dup := true; exit;
      end if;
    end loop;
    v_eff := ceil((v_pick->>'ch')::numeric / v_l);
    if v_dup then
      v_dup_count := v_dup_count + 1;
      v_ess := v_ess + public._dup_sell_value(v_pick->>'tier', (v_pick->>'bc')::numeric, v_pick->>'mut', (v_pick->>'shiny')='true');
      v_res := v_res || jsonb_build_array(jsonb_build_object(
        'cardId',v_pick->>'char','tier',v_pick->>'tier','mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true',
        'chance',(v_pick->>'ch')::numeric,'eff',v_eff,'dup',true));
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack)
        values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',true,p_pack);
    else
      v_new_count := v_new_count + 1;
      v_ns_id := substr(md5(random()::text || clock_timestamp()::text),1,9);
      v_ns := jsonb_build_object(
        'id',v_ns_id,'char',v_pick->>'char','tier',v_pick->>'tier','fav',false,'lock',false,
        'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true','trait','none','count',1);
      v_stacks := v_stacks || jsonb_build_array(v_ns);
      v_new := v_new || jsonb_build_array(v_ns);
      v_res := v_res || jsonb_build_array(jsonb_build_object(
        'cardId',v_pick->>'char','tier',v_pick->>'tier','stackId',v_ns_id,
        'mut',v_pick->>'mut','shiny',(v_pick->>'shiny')='true',
        'chance',(v_pick->>'ch')::numeric,'eff',v_eff,'dup',false));
      insert into public.roll_history (username,user_id,card_id,mut,shiny,dup,pack)
        values (v_uname,v_uid,v_pick->>'char',v_pick->>'mut',(v_pick->>'shiny')='true',false,p_pack);
      if (v_pick->>'ch')::numeric > v_rarest_ch then
        v_rarest_ch := (v_pick->>'ch')::numeric;
        v_rarest := jsonb_build_object('char',v_pick->>'char','mut',v_pick->>'mut',
          'shiny',(v_pick->>'shiny')='true','ch',v_rarest_ch);
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

  return jsonb_build_object('ok',true,'results',v_res,'total',v_cnt,
    'newStacks',v_new,'rollPacks',coalesce(v_save->'rollPacks','{}'::jsonb),
    'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,
    'rarestPull',v_rarest,'luck',v_l,'luckServer',v_l_srv,'shinyMult',v_s_mult);
end;
$fn$;

-- ---------- 6) ACL ----------
do $$
begin
  execute 'revoke all on function public._pass_luck_mult(text) from public, anon, authenticated';
  execute 'revoke all on function public._pass_shiny_mult(text) from public, anon, authenticated';
  execute 'revoke all on function public._luck_of(jsonb,text) from public, anon, authenticated';
  execute 'revoke all on function public._roll_common_scale(jsonb,text,numeric) from public, anon, authenticated';
  execute 'revoke all on function public._roll_entries(jsonb,text,numeric,numeric) from public, anon, authenticated';

  execute 'revoke all on function public.bulk_roll(text,integer,numeric) from public';
  execute 'revoke execute on function public.bulk_roll(text,integer,numeric) from anon';
  execute 'grant execute on function public.bulk_roll(text,integer,numeric) to authenticated';

  execute 'revoke all on function public.roll_pull(integer,text,numeric) from public';
  execute 'revoke execute on function public.roll_pull(integer,text,numeric) from anon';
  execute 'grant execute on function public.roll_pull(integer,text,numeric) to authenticated';
end $$;

notify pgrst, 'reload schema';
