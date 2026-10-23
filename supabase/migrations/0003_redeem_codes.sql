-- ===========================================================
-- REDEEM CODE (Trakteer Shop) — top-up tanpa Google Play
-- Satu kode = satu pembelian. Kredit gems ATOMIK + idempotent.
-- Jalankan: npx supabase db push
-- ===========================================================

create table if not exists public.redeem_codes (
  code         text primary key,
  pack_id      text not null,
  gems         integer not null,
  amount_idr   bigint not null,
  used_by      text,
  used_at      timestamptz,
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_redeem_codes_pack on public.redeem_codes(pack_id);
create index if not exists idx_redeem_codes_used on public.redeem_codes(used_by);

-- RLS aktif, TIDAK ada policy untuk anon/authenticated:
-- kode hanya bisa diakses lewat service_role (Edge Function).
alter table public.redeem_codes enable row level security;

-- ------------------------------------------------------------
-- Redeem satu kode -> kredit gems 1x ke pemilik akun.
-- Idempotent: kode yang sudah dipakai -> already=true, tanpa kredit lagi.
-- ------------------------------------------------------------
create or replace function public.redeem_code(
  p_code         text,
  p_username     text,
  p_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c          public.redeem_codes%rowtype;
  stored_pw  text;
  cur_gems   integer;
  new_gems   integer;
  u          text;
  norm_code  text;
begin
  u := lower(trim(coalesce(p_username, '')));
  norm_code := upper(trim(coalesce(p_code, '')));

  if u = '' or norm_code = '' or coalesce(p_password_hash, '') = '' then
    raise exception 'BAD_INPUT';
  end if;

  -- 1) AUTENTIKASI DULU (sebelum cek status kode).
  --    Kalau tidak, kode yang sudah dipakai bisa dicek tanpa knowing password.
  select password into stored_pw
    from public.player_saves where username = u for update;
  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;
  if stored_pw is distinct from p_password_hash then
    raise exception 'AUTH_FAILED';
  end if;

  -- 2) lock baris kode: 2 request paralel tidak bisa redeem kode yang sama
  select * into c from public.redeem_codes where code = norm_code for update;
  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;

  if not c.active then
    raise exception 'CODE_INACTIVE';
  end if;

  -- 3) Kode sudah dipakai -> already=true, TANPA kredit lagi.
  --    Kalau dipakai akun LAIN, tolak (jangan bocorkan info ke orang lain).
  if c.used_by is not null then
    if c.used_by <> u then
      raise exception 'CODE_ALREADY_USED';
    end if;
    select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into cur_gems
      from public.player_saves where username = u;
    return jsonb_build_object('ok', true, 'already', true, 'gems', c.gems,
                              'balance', coalesce(cur_gems, 0), 'pack_id', c.pack_id);
  end if;

  if c.expires_at is not null and c.expires_at <= now() then
    raise exception 'CODE_EXPIRED';
  end if;

  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0) into cur_gems
    from public.player_saves where username = u;

  new_gems := coalesce(cur_gems, 0) + c.gems;

  update public.player_saves
     set save_data = jsonb_set(coalesce(save_data, '{}'::jsonb), '{premiumGems}',
                 to_jsonb(new_gems), true),
         updated_at = now()
   where username = u;

  update public.redeem_codes
     set used_by = u, used_at = now()
   where code = norm_code;

  return jsonb_build_object('ok', true, 'already', false, 'gems', c.gems,
                            'balance', new_gems, 'pack_id', c.pack_id);
end;
$$;

revoke all on function public.redeem_code(text, text, text) from public, anon, authenticated;
grant execute on function public.redeem_code(text, text, text) to service_role;

-- ------------------------------------------------------------
-- Generate kode redeem batch (dipakai admin / script pembuatan
-- file .txt untuk Trakteer Shop). Service-role only.
-- Contoh: select public.admin_generate_codes('p100', 20, 90);
-- ------------------------------------------------------------
create or replace function public.admin_generate_codes(
  p_pack_id      text,
  p_count        integer,
  p_expires_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gems      integer;
  amount    bigint;
  i         integer;
  new_code  text;
  made      text[] := '{}';
begin
  if coalesce(p_count, 0) <= 0 or p_count > 1000 then
    raise exception 'BAD_COUNT';
  end if;

  -- harga & gems ditentukan server, bukan dari client
  select case p_pack_id
           when 'p100'  then 100
           when 'p500'  then 500
           when 'p1000' then 1000
           when 'p2500' then 2500
           when 'p5000' then 5000
         end,
         case p_pack_id
           when 'p100'  then 10000
           when 'p500'  then 50000
           when 'p1000' then 100000
           when 'p2500' then 250000
           when 'p5000' then 500000
         end
    into gems, amount;

  if gems is null then
    raise exception 'UNKNOWN_PACK';
  end if;

  for i in 1..p_count loop
    new_code := 'ACB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
                         || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
                         || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    begin
      insert into public.redeem_codes (code, pack_id, gems, amount_idr, expires_at)
      values (new_code, p_pack_id, gems, amount,
              case when coalesce(p_expires_days, 0) > 0
                   then now() + (p_expires_days || ' days')::interval else null end);
      made := made || new_code;
    exception when unique_violation then
      i := i - 1; -- retry dengan kode lain
    end;
  end loop;

  return jsonb_build_object('ok', true, 'pack_id', p_pack_id, 'gems', gems,
                            'amount_idr', amount, 'count', array_length(made, 1),
                            'codes', to_jsonb(made));
end;
$$;

revoke all on function public.admin_generate_codes(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_generate_codes(text, integer, integer) to service_role;

