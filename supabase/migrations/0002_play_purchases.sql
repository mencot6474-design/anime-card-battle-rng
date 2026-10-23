-- ===========================================================
-- TOP-UP GEMS (Google Play Billing) — schema & settlement
-- Jalankan di Supabase SQL Editor, atau: npx supabase db push
-- ===========================================================

create table if not exists public.play_purchases (
  purchase_id      text primary key,           -- id dari Play Developer API
  purchase_token   text unique not null,       -- token dari Billing Library (idempotency key)
  order_id         text unique,                -- orderId Google Play
  username         text not null,
  pack_id          text not null,
  product_id       text not null,
  gems             integer not null,
  amount_idr       bigint not null,
  status           text not null default 'pending', -- pending | paid | failed | refunded
  purchase_state   integer,                    -- purchaseState Play (0 purchased, 1 canceled, 2 pending)
  acknowledged     boolean not null default false,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_play_purchases_username on public.play_purchases(username);
create index if not exists idx_play_purchases_status   on public.play_purchases(status);

-- RLS: hanya service_role (Edge Function play-verify) yang boleh akses.
alter table public.play_purchases enable row level security;

-- ------------------------------------------------------------
-- Settlement idempotent: kredit gems 1x per purchase_token.
-- Kalau purchase_token sudah pernah diproses => tidak ada kredit kedua.
-- ------------------------------------------------------------
create or replace function public.settle_play_purchase(
  p_purchase_token text,
  p_purchase_id    text,
  p_order_id       text,
  p_username       text,
  p_pack_id        text,
  p_product_id     text,
  p_gems           integer,
  p_amount_idr     bigint,
  p_purchase_state integer default 0,
  p_acknowledged   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id text;
  old_gems   integer;
  new_gems   integer;
  inserted   boolean;
begin
  if p_purchase_token is null or p_purchase_token = '' then
    raise exception 'PURCHASE_TOKEN_WAJIB';
  end if;
  if p_username is null or p_username = '' then
    raise exception 'USERNAME_WAJIB';
  end if;

  -- 1) Kalau token ini sudah pernah settled => jangan kredit lagi.
  select purchase_id into existing_id
    from public.play_purchases
   where purchase_token = p_purchase_token;

  if existing_id is not null then
    select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into old_gems
      from public.player_saves where username = lower(p_username);
    return jsonb_build_object('ok', true, 'already', true,
                              'purchase_id', existing_id,
                              'gems', p_gems,
                              'balance', coalesce(old_gems, 0));
  end if;

  -- 2) Simpan purchase baru (status paid).
  insert into public.play_purchases
    (purchase_id, purchase_token, order_id, username, pack_id, product_id,
     gems, amount_idr, status, purchase_state, acknowledged, paid_at, updated_at)
  values
    (coalesce(nullif(p_purchase_id, ''), 'play_' || md5(p_purchase_token)),
     p_purchase_token,
     nullif(p_order_id, ''),
     lower(p_username),
     p_pack_id,
     p_product_id,
     p_gems,
     p_amount_idr,
     'paid',
     p_purchase_state,
     coalesce(p_acknowledged, false),
     now(), now())
  on conflict (purchase_token) do nothing;

  inserted := found;
  if not inserted then
    select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into old_gems
      from public.player_saves where username = lower(p_username);
    return jsonb_build_object('ok', true, 'already', true,
                              'gems', p_gems, 'balance', coalesce(old_gems, 0));
  end if;

  -- 3) Kredit gems (hanya kalau baris benar-benar baru dibuat).
  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
                 to_jsonb(coalesce(nullif(save_data->>'premiumGems','')::integer, 0) + p_gems), true),
         updated_at = now()
   where username = lower(p_username)
  returning coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into new_gems;

  if new_gems is null then
    raise exception 'PLAYER_NOT_FOUND:%', p_username;
  end if;

  return jsonb_build_object('ok', true, 'already', false,
                            'gems', p_gems, 'balance', new_gems);
end;
$$;

revoke all on function public.settle_play_purchase(text, text, text, text, text, text, integer, bigint, integer, boolean) from public, anon, authenticated;
grant execute on function public.settle_play_purchase(text, text, text, text, text, text, integer, bigint, integer, boolean) to service_role;

-- ------------------------------------------------------------
-- Tandai purchase sebagai sudah di-acknowledge ke Play (RTDN).
-- ------------------------------------------------------------
create or replace function public.ack_play_purchase(p_purchase_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.play_purchases
     set acknowledged = true, updated_at = now()
   where purchase_token = p_purchase_token;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ack_play_purchase(text) from public, anon, authenticated;
grant execute on function public.ack_play_purchase(text) to service_role;
