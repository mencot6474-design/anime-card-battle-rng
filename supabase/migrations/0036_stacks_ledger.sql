-- 0036_stacks_ledger.sql — Unit 4c: ledger hasil roll + validasi stacks.
-- DIBUAT OLEH _tmp/gen_0036.cjs — JANGAN SUNTING MANUAL (jalankan gen_0034.cjs dulu).
-- roll_pull = salinan utuh dari 0034 + insert roll_history.
-- merge_player_state = salinan utuh dari 0037 + panggilan _validate_stacks_ledger.
--
-- MODE: roll_config('ledger_enforce') = 0  -> shadow: pelanggaran dicatat ke tamper_log
-- (reason STACK_UNLEDGERED) tapi stacks TIDAK diubah. Naikkan ke 1 hanya setelah
-- beberapa hari terbukti tidak ada pemain jujur yang kena (lihat §7 AGENTS.md).

-- 1) RIWAYAT ROLL + SNAPSHOT LEGACY
create table if not exists public.roll_history (
  id       bigserial primary key,
  username text    not null,
  user_id  uuid,
  card_id  text    not null,
  mut      text    not null default 'none',
  shiny    boolean not null default false,
  dup      boolean not null default false,
  pack     text,
  rolled_at timestamptz not null default now()
);

create index if not exists idx_roll_history_user   on public.roll_history(user_id, rolled_at);
create index if not exists idx_roll_history_lookup on public.roll_history(username, card_id, mut, shiny, dup);

/* Kunci varian yang SUDAH ada di save saat migrasi ini jalan. Tanpa ini, semua kartu
   pemain lama tidak punya bukti dan (kalau enforce dinyalakan) akan dibuang. */
create table if not exists public.stacks_legacy (
  username text not null,
  vkey     text not null,
  primary key (username, vkey)
);

do $$
declare t text;
begin
  foreach t in array array['roll_history','stacks_legacy'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to service_role', t);
  end loop;
end $$;

insert into public.stacks_legacy (username, vkey)
select s.username,
       (o->>'char') || '|' ||
       coalesce(nullif(o->>'mut',''), 'none') || '|' ||
       case when coalesce(o->>'shiny','false') in ('true','1') then '1' else '0' end
  from public.player_saves s
  cross join jsonb_array_elements(coalesce(s.save_data->'stacks','[]'::jsonb)) o
 on conflict (username, vkey) do nothing;

-- 2) roll_pull VERSI LEDGER: sama seperti 0034 + catat tiap pull ke roll_history.
create or replace function public.roll_pull(
  p_count integer default 1,
  p_pack  text    default null,
  p_luck  numeric default null
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
  v_aw      text;
  v_cnt     integer := greatest(1, least(coalesce(p_count,1), 100));
  v_use_pack boolean := p_pack is not null and p_pack <> '';
  v_pack_def record;
  v_owned   integer := 0;
  v_use     integer := 0;
  v_res     jsonb := '[]'::jsonb;
  v_r       record;
  v_m       record;
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
  v_ch      numeric;
  v_l       numeric;
  v_l_srv   numeric;
  v_sm_c    numeric := coalesce((select val from public.roll_config where key='shiny_chance_mult'), 50);
  v_rare_den numeric := coalesce((select val from public.roll_config where key='roll_rare_den'), 50000);
  v_k       numeric;
  v_total   numeric := 0;
  v_rnd     numeric;
  v_acc     numeric := 0;
  v_entries jsonb[] := '{}';
  v_w       numeric;

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

  v_aw := case when v_save->'weather' is not null
               and coalesce((v_save->'weather'->>'endsAt')::bigint,0) > (extract(epoch from now())*1000)::bigint
          then v_save->'weather'->>'id' else null end;

  /* Luck: server hitung sendiri dari cermin, client cuma boleh naik di atasnya
     sebatas buff sesi (potion/iklan) x luck_allow_cap. see _luck_of(). */
  v_l_srv := public._luck_of(v_save);
  if v_l_srv <= 0 then v_l_srv := 1; end if;
  v_l := coalesce(p_luck, v_l_srv);
  if v_l <= 0 then v_l := v_l_srv; end if;
  v_l := greatest(v_l, v_l_srv);
  v_l := least(v_l, v_l_srv * coalesce((select val from public.roll_config where key='luck_allow_cap'), 6));

  v_k := public._roll_common_scale(v_save, v_aw);
  v_stacks := coalesce(v_save->'stacks','[]'::jsonb);

  for v_r in select rp.char_id, rp.tier, rp.chance, rp.no_gacha, rp.raid_boss, rp.tower_boss, rp.weather_only
             from public.roll_pool_def rp order by rp.char_id loop
    if coalesce(v_r.no_gacha,false) then continue; end if;
    if (v_r.raid_boss or v_r.tower_boss) then
      if not (
        (coalesce(v_save->'raidShopOwned','{}'::jsonb) ? v_r.char_id) or
        (coalesce(v_save->'towerShopOwned','{}'::jsonb) ? v_r.char_id) or
        exists(select 1 from jsonb_array_elements(v_stacks) s where s->>'char'=v_r.char_id)
      ) then continue; end if;
    end if;
    if v_r.weather_only is not null and v_r.weather_only <> coalesce(v_aw,'') then continue; end if;
    if coalesce(v_r.chance,0) <= 0 then continue; end if;
    for v_m in select m.mut, m.chance_mult from public.roll_mut_rates m order by m.ord loop
      /* shiny = true */
      v_ch := v_r.chance * v_sm_c * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := v_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',true,'ch',v_ch,'bc',v_r.chance,'w',v_w));
      /* shiny = false */
      v_ch := v_r.chance * coalesce(v_m.chance_mult,1);
      if v_ch >= v_rare_den then v_w := v_l / v_ch; else v_w := v_k / v_ch; end if;
      v_total := v_total + v_w;
      v_entries := array_append(v_entries, jsonb_build_object(
        'char',v_r.char_id,'tier',v_r.tier,'mut',v_m.mut,'shiny',false,'ch',v_ch,'bc',v_r.chance,'w',v_w));
    end loop;
  end loop;

  if v_total <= 0 or array_length(v_entries,1) is null then
    return jsonb_build_object('ok',false,'msg','EMPTY_POOL');
  end if;

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
      /* Stack yang BARU DIBUAT server dikirim balik (v_new) supaya id client == id di DB.
         Bukan seluruh 'stacks' (74 KB), hanya yang lahir dari roll ini (<= 100 x ~130 B). */
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

  /* TIDAK mengembalikan seluruh 'stacks' (74 KB di save terukur) — hanya yang baru lahir
     ('newStacks') + saldo pack + delta essence/totalRolls. Hemat egress free tier. */
  return jsonb_build_object('ok',true,'results',v_res,'total',v_cnt,
    'newStacks',v_new,'rollPacks',coalesce(v_save->'rollPacks','{}'::jsonb),
    'newCount',v_new_count,'dupCount',v_dup_count,'rebirthGain',v_ess,
    'rarestPull',v_rarest,'luck',v_l,'luckServer',v_l_srv);

end;
$$;

do $$
begin
  execute 'revoke all on function public.roll_pull(integer,text,numeric) from public';
  execute 'revoke execute on function public.roll_pull(integer,text,numeric) from anon';
  execute 'grant execute on function public.roll_pull(integer,text,numeric) to authenticated';
  -- jaga-jaga kalau draft lama (2 argumen) sempat terpakai: overload lama tidak boleh hidup
  execute 'drop function if exists public.roll_pull(integer,text)';
end $$;

-- 3) VALIDATOR STACKS vs LEDGER
create or replace function public._validate_stacks_ledger(p_uname text, p_stacks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enforce numeric := coalesce((select val from public.roll_config where key='ledger_enforce'), 0);
  v_out     jsonb := '[]'::jsonb;
  v_drop    jsonb := '[]'::jsonb;
  v_s       jsonb;
  v_key     text;
  v_ok      boolean;
begin
  if p_uname is null or p_stacks is null or jsonb_typeof(p_stacks) <> 'array' then
    return coalesce(p_stacks, '[]'::jsonb);
  end if;

  for v_s in select jsonb_array_elements(p_stacks) loop
    v_key := (v_s->>'char') || '|' ||
             coalesce(nullif(v_s->>'mut',''), 'none') || '|' ||
             case when coalesce(v_s->>'shiny','false') in ('true','1') then '1' else '0' end;
    select exists (
             select 1 from public.stacks_legacy l
              where l.username = p_uname and l.vkey = v_key
           ) or exists (
             select 1 from public.roll_history h
              where h.username = p_uname
                and h.card_id = (v_s->>'char')
                and h.mut = coalesce(nullif(v_s->>'mut',''),'none')
                and h.shiny = (case when coalesce(v_s->>'shiny','false') in ('true','1') then true else false end)
                and h.dup = false
           )
      into v_ok;
    if coalesce(v_ok, false) then
      v_out := v_out || jsonb_build_array(v_s);
    else
      v_drop := v_drop || jsonb_build_array(v_s);
    end if;
  end loop;

  if jsonb_array_length(v_drop) > 0 then
    /* Detail DIBATASI (20 contoh + jumlah): jalur instantRollFast (INTAN 100K, masih
       client-side di unit ini) menyuntik ratusan kartu tanpa riwayat -> tanpa batas,
       tamper_log membengkak oleh satu baris raksasa. */
    perform public._tamper(p_uname, 'STACK_UNLEDGERED', 'stacks',
      jsonb_array_length(p_stacks)::text, jsonb_array_length(v_out)::text,
      jsonb_build_object('enforce', v_enforce, 'droppedCount', jsonb_array_length(v_drop),
                         'droppedSample', (select coalesce(jsonb_agg(d), '[]'::jsonb)
                                             from (select d from jsonb_array_elements(v_drop) d limit 20) s)));
  end if;

  if coalesce(v_enforce, 0) <= 0 then
    return p_stacks;   -- shadow mode: jangan pernah buang kartu pemain
  end if;
  return v_out;
end;
$$;

do $$
begin
  execute 'revoke all on function public._validate_stacks_ledger(text,jsonb) from public';
  execute 'revoke execute on function public._validate_stacks_ledger(text,jsonb) from anon, authenticated';
end $$;

-- 4) MERGEPLAYERSTATE + validasi ledger (salinan 0037, hanya satu baris tambahan)
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
  merged := jsonb_set(merged, '{stacks}', public._clean_stacks(merged->'stacks'), true);

  -- 0036: kartu harus punya bukti (snapshot legacy ATAU riwayat roll server).
  -- Selama roll_config.ledger_enforce = 0 ini HANYA mencatat (shadow), tidak membuang.
  -- PENTING: _validate_stacks_ledger menerima dan MENGEMBALIKAN ARRAY stacks, bukan
  -- save utuh — hasilnya harus dipasang kembali ke '{stacks}'. Menulis
  -- "merged := _validate_stacks_ledger(...)" membuat merged jadi array dan seluruh
  -- jsonb_set berikutnya gagal ("path element ... is not an integer").
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

do $$
begin
  -- SAMAKAN DENGAN DB LIVE (probe 2026-10-28): merge_player_state,jsonb,boolean,boolean
  -- cuma bisa dijalankan authenticated + service_role. anon sudah di-revoke; jangan
  -- sampai migrasi ini meng-grant anon lagi (RPC tulis = permukaan cheat).
  execute 'revoke all on function public.merge_player_state(jsonb,boolean,boolean) from public, anon';
  execute 'grant execute on function public.merge_player_state(jsonb,boolean,boolean) to authenticated, service_role';
end $$;

select pg_notify('pgrst', 'reload schema');
