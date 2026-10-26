-- 0035_trait_server.sql — Unit 4b: trait reroll server-authoritative
--
-- Tujuan: pindahin rollTraitPick() ke server biar gak bisa dimanipulasi
-- deploy: apply via _tmp/apply_sql.cjs (baca _tmp/sbpat.txt)

-- 1) MIRROR TRAIT
create table if not exists public.trait_def (
  k text primary key,
  atk numeric not null default 1,
  hp numeric not null default 1,
  chance numeric not null default 0,
  color text,
  rar text,
  fx jsonb not null default '{}'::jsonb
);

alter table public.trait_def enable row level security;
revoke all on public.trait_def from anon, authenticated;
grant select on public.trait_def to service_role;

-- 2) RPC trait_roll
create or replace function public.trait_roll(p_stack_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_uname text;
  v_save jsonb;
  v_stacks jsonb := '[]'::jsonb;
  v_tgt jsonb := null;
  v_new_stacks jsonb := '[]'::jsonb;
  v_s jsonb;
  v_trait_cost numeric := 500;
  v_coins numeric;
  v_total numeric := 0;
  v_r numeric;
  v_k text := 'common';
  v_t record;
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
  if v_coins < v_trait_cost then
    return jsonb_build_object('ok',false,'msg','COIN_LESS');
  end if;

  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);
  -- cari stack target
  for v_s in select jsonb_array_elements(v_stacks) loop
    if v_s->>'id' = p_stack_id then
      v_tgt := v_s;
    else
      v_new_stacks := v_new_stacks || jsonb_build_array(v_s);
    end if;
  end loop;

  if v_tgt is null then
    return jsonb_build_object('ok',false,'msg','STACK_NOT_FOUND');
  end if;

  -- hitung total weight
  select sum(coalesce(chance,0)) into v_total from public.trait_def where coalesce(chance,0) > 0;
  if coalesce(v_total,0) <= 0 then
    v_total := 100;
  end if;

  v_r := random() * v_total;
  v_k := 'common';
  for v_t in select k, chance from public.trait_def where coalesce(chance,0) > 0 order by k loop
    v_r := v_r - coalesce(v_t.chance,0);
    if v_r <= 0 then
      v_k := v_t.k;
      exit;
    end if;
  end loop;

  -- update stack
  v_tgt := jsonb_set(v_tgt, '{trait}', to_jsonb(v_k));
  v_new_stacks := v_new_stacks || jsonb_build_array(v_tgt);
  v_save := jsonb_set(v_save, '{stacks}', v_new_stacks);
  v_save := jsonb_set(v_save, '{coins}', to_jsonb(v_coins - v_trait_cost));

  update public.player_saves set save_data = v_save, updated_at = now() where user_id = v_uid;

  return jsonb_build_object('ok',true,'trait',v_k,'coins', v_coins - v_trait_cost, 'stackId', p_stack_id);
end;
$$;

revoke all on function public.trait_roll(text) from public;
revoke execute on function public.trait_roll(text) from anon;
grant execute on function public.trait_roll(text) to authenticated;
