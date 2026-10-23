-- ===========================================================
-- TOP-UP GEMS (Xendit Invoice) — schema transaksi
-- Jalankan di Supabase SQL Editor, atau: npx supabase db push
-- ===========================================================

create table if not exists public.topup_orders (
  order_id           text primary key,
  external_id        text unique not null,
  username           text not null,
  pack_id            text not null,
  gems               integer not null,
  amount_idr         bigint not null,
  status             text not null default 'pending',  -- pending | paid | expired | failed
  xendit_invoice_id  text,
  invoice_url        text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_topup_orders_username on public.topup_orders(username);
create index if not exists idx_topup_orders_status   on public.topup_orders(status);
create index if not exists idx_topup_orders_invoice  on public.topup_orders(xendit_invoice_id);

-- RLS: tabel ini HANYA boleh diakses lewat service_role (Edge Function).
-- Client tidak pernah query langsung => tidak bisa men forging order.
alter table public.topup_orders enable row level security;

-- Tidak ada policy untuk anon/authenticated: order hanya dibaca lewat Edge Function
-- (order-status), yang memverifikasi username + password hash pemilik order.

-- ------------------------------------------------------------
-- Fungsi atomik & idempotent: selesaikan order (kredit gems 1x)
-- Dipakai webhook + fallback polling.
-- ------------------------------------------------------------
create or replace function public.settle_topup(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.topup_orders%rowtype;
  old_gems   integer;
  new_gems   integer;
begin
  select * into o from public.topup_orders where order_id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if o.status = 'paid' then
    select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into old_gems
      from public.player_saves where username = o.username;
    return jsonb_build_object('ok', true, 'already', true, 'order_id', o.order_id,
                              'gems', o.gems, 'balance', coalesce(old_gems, 0), 'status', o.status);
  end if;

  update public.player_saves
     set save_data  = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
                 to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer, 0) + o.gems), true),
         updated_at = now()
   where username = o.username
  returning coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into new_gems;

  if new_gems is null then
    raise exception 'PLAYER_NOT_FOUND:%', o.username;
  end if;

  update public.topup_orders
     set status = 'paid', paid_at = now(), updated_at = now()
   where order_id = o.order_id;

  return jsonb_build_object('ok', true, 'already', false, 'order_id', o.order_id,
                            'gems', o.gems, 'balance', new_gems, 'status', 'paid');
end;
$$;

revoke all on function public.settle_topup(text) from public, anon, authenticated;
grant execute on function public.settle_topup(text) to service_role;

-- Set status order lain (expired/failed) tanpa kredit.
create or replace function public.set_topup_status(p_order_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.topup_orders%rowtype;
begin
  update public.topup_orders
     set status = p_status, updated_at = now()
   where order_id = p_order_id and status <> 'paid'
  returning * into o;
  return jsonb_build_object('ok', true, 'order_id', p_order_id, 'status', coalesce(o.status, p_status));
end;
$$;

revoke all on function public.set_topup_status(text, text) from public, anon, authenticated;
grant execute on function public.set_topup_status(text, text) to service_role;

-- ------------------------------------------------------------
-- Merge state player (dipakai client via RPC).
-- Kalau premiumGems lokal lebih kecil dari saldo cloud (mis. karena
-- kredit top-up dari server belum ter-sync ke browser), saldo cloud
-- yang dipertahankan. Penurunan saldo hanya boleh kalau
-- p_allow_gem_decrease = true (dipakai saat player belanja item).
-- ------------------------------------------------------------
create or replace function public.merge_player_state(
  p_username text,
  p_password_hash text,
  p_save_data jsonb,
  p_allow_gem_decrease boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_gems  integer;
  new_gems  integer;
  merged    jsonb;
  stored_pw text;
begin
  if p_username is null or p_save_data is null then
    raise exception 'BAD_INPUT';
  end if;

  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0), password
    into cur_gems, stored_pw
    from public.player_saves where username = lower(p_username);

  if cur_gems is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  -- WAJIB: hanya pemilik akun yang boleh menyimpan state-nya.
  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  new_gems := coalesce(nullif(p_save_data->>'premiumGems','')::integer, 0);

  -- Saldo cloud = authoritative.
  --  - mode biasa (p_allow_gem_decrease = false): SELALU pakai saldo cloud,
  --    jadi nilai lokal yang lebih besar tidak bisa "dibuat" user.
  --  - mode belanja (p_allow_gem_decrease = true): boleh turun (potong),
  --    tapi kalau nilai lokal lebih besar dari cloud -> pakai cloud.
  if p_allow_gem_decrease and new_gems < cur_gems then
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(new_gems), true);
  else
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(cur_gems), true);
  end if;

  update public.player_saves
     set save_data = merged, updated_at = now()
   where username = lower(p_username);

  return jsonb_build_object('ok', true, 'premiumGems',
    coalesce(nullif(merged->>'premiumGems','')::integer, cur_gems));
end;
$$;

revoke all on function public.merge_player_state(text, text, jsonb, boolean) from public;
grant execute on function public.merge_player_state(text, text, jsonb, boolean) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Potong gems secara atomik (saat player belanja item).
-- Menjamin: saldo tidak bisa minus, dan kredit top-up yang masuk
-- bersamaan tidak hilang (dibaca ulang di dalam transaksi).
-- ------------------------------------------------------------
create or replace function public.spend_gems(
  p_username text,
  p_password_hash text,
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
  cur_gems  integer;
  stored_pw text;
  merged    jsonb;
begin
  if p_username is null or p_cost is null or p_cost < 0 then
    raise exception 'BAD_INPUT';
  end if;

  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0), password
    into cur_gems, stored_pw
    from public.player_saves
   where username = lower(p_username)
   for update;

  if cur_gems is null then
    return jsonb_build_object('ok', false, 'msg', 'PLAYER_NOT_FOUND');
  end if;

  if stored_pw is null or stored_pw <> p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  if cur_gems < p_cost then
    return jsonb_build_object('ok', false, 'msg', 'GEMS_TIDAK_CUKUP',
                              'balance', cur_gems, 'cost', p_cost);
  end if;

  merged := coalesce(p_save_data, (select save_data from public.player_saves
                                    where username = lower(p_username)));
  merged := jsonb_set(coalesce(merged, '{}'::jsonb), '{premiumGems}',
                      to_jsonb(cur_gems - p_cost), true);

  update public.player_saves
     set save_data = merged, updated_at = now()
   where username = lower(p_username);

  return jsonb_build_object('ok', true, 'balance', cur_gems - p_cost, 'cost', p_cost);
end;
$$;

revoke all on function public.spend_gems(text, text, integer, boolean, jsonb) from public;
grant execute on function public.spend_gems(text, text, integer, boolean, jsonb) to anon, authenticated, service_role;
