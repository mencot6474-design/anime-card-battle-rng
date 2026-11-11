-- ============================================================================
-- Migration 0047: Rebirth x5 Sequential Luck Scaling
-- Updates server-side `_luck_of` so Rebirth Luck Multiplier scales x5 per
-- rebirth rank sequentially:
--   R0 -> 1x, R1 -> 5x, R2 -> 10x, R3 -> 15x, R4 -> 20x, ...
-- Mirrors client `rebirthLuckMult()` in js/state.js.
-- Signature & ACL unchanged (zero breaking changes).
-- ============================================================================

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
  v_rb_cnt integer := 0;
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

  v_rb_cnt := greatest(0, coalesce((p_save->'rebirth'->>'count')::integer, 0));
  v_rmult  := case when v_rb_cnt <= 0 then 1 else v_rb_cnt * 5 end;
  v_pmult  := public._pass_luck_mult(p_uname);

  return greatest(1, (v_base + v_flat) * (1 + v_pct) * v_wmult * v_gmult * v_rmult * v_pmult);
end;
$$;

do $$
begin
  execute 'revoke all on function public._luck_of(jsonb,text) from public, anon, authenticated';
end $$;

notify pgrst, 'reload schema';
