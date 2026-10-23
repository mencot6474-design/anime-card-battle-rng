-- ===========================================================
-- TRANSAKSI TRAKTEER SHOP — kredit gems otomatis via webhook
-- Idempotent: kunci = transaction_id (transaksi duplikat tidak
-- menyebabkan kredit gems dua kali).
-- Jalankan: npx supabase db push
-- ===========================================================

create table if not exists public.trakteer_transactions (
  transaction_id  text primary key,
  username        text not null,
  pack_id         text not null,
  gems            integer not null,
  amount_idr      bigint not null,
  product_id      text,
  status          text not null default 'paid',   -- paid | refunded
  raw_payload     jsonb,
  credited_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_trakteer_tx_username on public.trakteer_transactions(username);

-- RLS aktif tanpa policy: hanya service_role (Edge Function) yang boleh akses.
alter table public.trakteer_transactions enable row level security;

-- ------------------------------------------------------------
-- Settlement transaksi Trakteer -> kredit gems 1x.
-- Kalau transaction_id sudah ada => already=true, TANPA kredit lagi.
-- ------------------------------------------------------------
create or replace function public.settle_trakteer_transaction(
  p_transaction_id text,
  p_username       text,
  p_pack_id        text,
  p_gems           integer,
  p_amount_idr     bigint,
  p_product_id     text,
  p_raw            jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u          text;
  cur_gems   integer;
  new_gems   integer;
  tx_id      text;
  ins_count  integer;
begin
  u := lower(trim(coalesce(p_username, '')));
  tx_id := trim(coalesce(p_transaction_id, ''));

  if tx_id = '' or u = '' or coalesce(p_gems, 0) <= 0 then
    raise exception 'BAD_INPUT';
  end if;

  -- 1) Kunci idempotensi: INSERT DULU (transaction_id = PK).
  --    Kalau bentrok => transaksi ini sudah pernah diproses, TANPA kredit lagi.
  --    Melakukan insert sebelum update saldo menutup celah race:
  --    2 request paralel dengan transaction_id sama -> hanya 1 yang berhasil insert.
  insert into public.trakteer_transactions
    (transaction_id, username, pack_id, gems, amount_idr, product_id, status, raw_payload)
  values
    (tx_id, u, coalesce(nullif(p_pack_id,''), 'unknown'), p_gems,
     coalesce(p_amount_idr, 0), p_product_id, 'paid', p_raw)
  on conflict (transaction_id) do nothing;

  get diagnostics ins_count = row_count;
  if ins_count = 0 then
    -- sudah pernah diproses -> idempotent
    select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into cur_gems
      from public.player_saves where username = u;
    return jsonb_build_object('ok', true, 'already', true, 'gems', p_gems,
                              'balance', coalesce(cur_gems, 0),
                              'transaction_id', tx_id);
  end if;

  -- 2) Pastikan pemain ada. FOR UPDATE mengunci baris supaya 2 webhook
  --    bersamaan untuk 2 transaksi tidak saling menimpa saldo.
  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into cur_gems
    from public.player_saves where username = u for update;
  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  new_gems := cur_gems + p_gems;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
                 to_jsonb(new_gems), true),
         updated_at = now()
   where username = u;

  return jsonb_build_object('ok', true, 'already', false, 'gems', p_gems,
                            'balance', new_gems, 'transaction_id', tx_id);
end;
$$;

revoke all on function public.settle_trakteer_transaction(text, text, text, integer, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_trakteer_transaction(text, text, text, integer, bigint, text, jsonb)
  to service_role;
