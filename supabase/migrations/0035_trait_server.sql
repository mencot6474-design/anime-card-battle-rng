-- 0035_trait_server.sql — Unit 4b: trait reroll server-authoritative.
-- DIBUAT OLEH _tmp/gen_0034.cjs — JANGAN SUNTING MANUAL.
-- Cermin client: js/cards-fx.js TRAIT_TIERS (baris 193) + TRAIT_COST (baris 211)
-- dan rollTraitPick() (baris 213): r = random()*TRAIT_TOTAL, lewati chance 0.
-- Regenerate: node _tmp/gen_0034.cjs

-- 1) MIRROR TRAIT
create table if not exists public.trait_def (
  k       text primary key,
  atk     numeric not null default 1,
  hp      numeric not null default 1,
  chance  numeric not null default 0,
  color   text,
  rar     text,
  fx      jsonb not null default '{}'::jsonb,
  ord     integer not null default 0
);

alter table public.trait_def enable row level security;
revoke all on public.trait_def from anon, authenticated;
grant select on public.trait_def to service_role;

insert into public.trait_def (k, atk, hp, chance, color, rar, fx, ord) values
  ('none',1,1,0,'#9A8A8B','N/A','{}',0),
  ('common',1.1,1,55,'#9A8A8B','C','{}',1),
  ('rare',1.1,1.1,30,'#6EAC4C','R','{}',2),
  ('legendary',1.25,1,12,'#2F8FE2','SR','{}',3),
  ('superior',1.5,1.25,2.5,'#B58CFF','SSR','{}',4),
  ('transiden',2,1.5,0.486,'#F6DFA6','UR','{}',5),
  ('demigod',3,1.5,0.01,'#FF4D5E','EX','{}',6),
  ('cosmic',3.5,3.5,0.003,'#E56BFF','COS','{}',7),
  ('bigbang',5,4,0.001,'#7DF9FF','BB','{}',8)
on conflict (k) do update set
  atk = excluded.atk, hp = excluded.hp, chance = excluded.chance,
  color = excluded.color, rar = excluded.rar, fx = excluded.fx, ord = excluded.ord;

delete from public.trait_def where k not in ('none','common','rare','legendary','superior','transiden','demigod','cosmic','bigbang');

-- 2) RPC trait_roll
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
  v_new     jsonb := '[]'::jsonb;
  v_s       jsonb;
  v_cost    numeric := coalesce((select val from public.roll_config where key='trait_cost'), 500);
  v_coins   numeric;
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

  select username, save_data into v_uname, v_save from public.player_saves where user_id = v_uid;
  if v_uname is null or v_save is null then
    return jsonb_build_object('ok',false,'msg','PLAYER_NOT_FOUND');
  end if;

  v_coins := coalesce((v_save->>'coins')::numeric, 0);
  if v_coins < v_cost then
    return jsonb_build_object('ok',false,'msg','COIN_LESS');
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'id' = p_stack_id then
      v_tgt := v_s;
    else
      v_new := v_new || jsonb_build_array(v_s);
    end if;
  end loop;

  if v_tgt is NULL then
    return jsonb_build_object('ok',false,'msg','STACK_NOT_FOUND');
  end if;

  /* sama persis dengan rollTraitPick(): total = Σ chance (>0), lalu kurangi urut ord */
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

  v_tgt := jsonb_set(v_tgt, '{trait}', to_jsonb(v_k));
  v_new := v_new || jsonb_build_array(v_tgt);
  v_save := jsonb_set(v_save, '{stacks}', v_new);
  v_save := jsonb_set(v_save, '{coins}', to_jsonb(v_coins - v_cost));

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok',true,'trait',v_k,'coins',(v_coins - v_cost)::bigint,'stackId',p_stack_id);
end;
$$;

do $$
declare fn text;
begin
  execute 'revoke all on function public.trait_roll(text) from public';
  execute 'revoke execute on function public.trait_roll(text) from anon';
  execute 'grant execute on function public.trait_roll(text) to authenticated';
end $$;

select pg_notify('pgrst', 'reload schema');
