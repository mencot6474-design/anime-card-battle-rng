-- 0048_claim_guest_account.sql — Upgrade / klaim akun guest ke username permanen
-- tanpa mereset progres yang sudah dimainkan di server.
--
-- MASALAH SEBELUMNYA:
--   claimNamedAccount() di client memanggil register_player(), yang mendesain
--   pembuatan akun baru dari nol (mengulang koin=1000, gems=50, lv=1, rebirth=0,
--   pet/artefak/pass/skill tree kosong). Pemain guest yang sudah main jauh
--   kehilangan progres saat mengklaim akun.
--
-- SOLUSI AMAN (100% SERVER-AUTHORITATIVE):
--   1. Guest (auth.uid() lama) memanggil issue_guest_claim() untuk menerbitkan
--      token klaim satu-kali berumur 10 menit.
--   2. Client mendaftarkan login baru (CloudAuth.ensurePass -> auth.uid() baru).
--   3. Dengan JWT baru, client memanggil complete_guest_claim(token, new_user, pass_hash).
--   4. Server memindahkan kepemilikan (user_id, username, password, claimed_at)
--      serta seluruh tabel progres & ledger milik row guest asli ke username baru
--      dalam satu transaksi atomik. Tidak menerima angka/koin/gem/item dari client.

begin;

-- 1) Penanda agar satu save guest hanya bisa di-upgrade menjadi akun bernama 1x.
alter table public.player_saves
  add column if not exists claimed_at timestamptz;

-- 2) Tabel token klaim sekali-pakai (hanya diakses oleh RPC SECURITY DEFINER).
create table if not exists public.guest_claim_tokens (
  token       text primary key,
  guest_uid   uuid not null,
  guest_uname text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used_at     timestamptz,
  claimed_by  uuid
);

create index if not exists idx_guest_claim_tokens_uid
  on public.guest_claim_tokens (guest_uid);

alter table public.guest_claim_tokens enable row level security;
revoke all on table public.guest_claim_tokens from public, anon, authenticated;

-- 3) RPC Langkah 1: Diterbitkan oleh sesi guest yang sedang aktif.
create or replace function public.issue_guest_claim()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_uname   text;
  v_claimed timestamptz;
  v_tok     text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select username, claimed_at
    into v_uname, v_claimed
    from public.player_saves
   where user_id = v_uid
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'NO_GUEST_SAVE');
  end if;

  if v_claimed is not null then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_CLAIMED', 'username', v_uname);
  end if;

  -- Bersihkan token lama milik uid ini atau yang sudah kedaluwarsa.
  delete from public.guest_claim_tokens
   where guest_uid = v_uid
      or expires_at < now();

  v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.guest_claim_tokens (token, guest_uid, guest_uname)
  values (v_tok, v_uid, v_uname);

  return jsonb_build_object(
    'ok', true,
    'token', v_tok,
    'guest_username', v_uname
  );
end;
$$;

-- 4) RPC Langkah 2: Dipanggil oleh JWT Auth target (username & password baru)
--    untuk mengambil alih save & seluruh progres server guest secara atomik.
create or replace function public.complete_guest_claim(
  p_token             text,
  p_new_username      text,
  p_new_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_uid   uuid := auth.uid();
  v_new_uname text := lower(btrim(coalesce(p_new_username, '')));
  v_old_uname text;
  v_tok_row   public.guest_claim_tokens%rowtype;
  v_src       public.player_saves%rowtype;
begin
  if v_new_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if coalesce(btrim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'msg', 'BAD_TOKEN');
  end if;

  if v_new_uname !~ '^[a-z0-9_]{3,16}$' then
    return jsonb_build_object('ok', false, 'msg', 'INVALID_USERNAME');
  end if;

  if coalesce(btrim(p_new_password_hash), '') = '' then
    return jsonb_build_object('ok', false, 'msg', 'INVALID_PASSWORD');
  end if;

  select * into v_tok_row
    from public.guest_claim_tokens
   where token = p_token
     and used_at is null
     and expires_at > now()
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'INVALID_OR_EXPIRED_TOKEN');
  end if;

  if v_new_uid = v_tok_row.guest_uid then
    return jsonb_build_object('ok', false, 'msg', 'SAME_AUTH_USER');
  end if;

  select * into v_src
    from public.player_saves
   where user_id = v_tok_row.guest_uid
     and username = v_tok_row.guest_uname
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'GUEST_SAVE_NOT_FOUND');
  end if;

  if v_src.claimed_at is not null then
    return jsonb_build_object('ok', false, 'msg', 'ALREADY_CLAIMED');
  end if;

  v_old_uname := v_src.username;

  if v_new_uname = v_old_uname then
    return jsonb_build_object('ok', false, 'msg', 'SAME_USERNAME');
  end if;

  if exists (select 1 from public.player_saves where username = v_new_uname) then
    return jsonb_build_object('ok', false, 'msg', 'USERNAME_TAKEN');
  end if;

  if exists (select 1 from public.player_saves where user_id = v_new_uid) then
    return jsonb_build_object('ok', false, 'msg', 'TARGET_ALREADY_HAS_SAVE');
  end if;

  -- Kunci token agar tidak dapat dipakai ulang.
  update public.guest_claim_tokens
     set used_at = now(),
         claimed_by = v_new_uid
   where token = p_token;

  -- Bersihkan potensi orphan rows untuk username baru yang sudah dipastikan
  -- tidak punya row player_saves agar update composite PK bebas tabrakan.
  delete from public.coin_claims                 where username = v_new_uname;
  delete from public.coin_daily                  where username = v_new_uname;
  delete from public.daily_pack_amnesty          where username = v_new_uname;
  delete from public.dev_guard                   where username = v_new_uname;
  delete from public.gem_claims                  where username = v_new_uname;
  delete from public.gem_daily                   where username = v_new_uname;
  delete from public.guard_allow                 where username = v_new_uname;
  delete from public.index_reward_claims         where username = v_new_uname;
  delete from public.leaderboard_claims          where username = v_new_uname;
  delete from public.leaderboard_scores          where username = v_new_uname;
  delete from public.pack_allowance              where username = v_new_uname;
  delete from public.player_items                where username = v_new_uname;
  delete from public.player_packs                where username = v_new_uname;
  delete from public.player_progress             where username = v_new_uname;
  delete from public.rebirth_daily               where username = v_new_uname;
  delete from public.roll_ledger                 where username = v_new_uname;
  delete from public.rpc_guard                   where username = v_new_uname;
  delete from public.rpc_rate                    where username = v_new_uname;
  delete from public.stacks_legacy               where username = v_new_uname;
  delete from public.stacks_legacy_5b3           where username = v_new_uname;
  delete from public.story_progress              where username = v_new_uname;
  delete from public.token_daily                 where username = v_new_uname;
  delete from public.tower_progress              where username = v_new_uname;
  delete from public.world_boss_milestone_claims where username = v_new_uname;
  delete from public.world_boss_runs             where username = v_new_uname;
  delete from public.xp_daily                    where username = v_new_uname;

  -- Migrasikan seluruh tabel ledger, progres, guard, dan histori ke username baru.
  update public.coin_claims                 set username = v_new_uname where username = v_old_uname;
  update public.coin_daily                  set username = v_new_uname where username = v_old_uname;
  update public.daily_pack_amnesty          set username = v_new_uname where username = v_old_uname;
  update public.dev_guard                   set username = v_new_uname where username = v_old_uname;
  update public.gem_claims                  set username = v_new_uname where username = v_old_uname;
  update public.gem_daily                   set username = v_new_uname where username = v_old_uname;
  update public.guard_allow                 set username = v_new_uname where username = v_old_uname;
  update public.index_reward_claims         set username = v_new_uname where username = v_old_uname;
  update public.item_penalty                set username = v_new_uname where username = v_old_uname;
  update public.leaderboard_claims          set username = v_new_uname where username = v_old_uname;
  update public.leaderboard_scores          set username = v_new_uname where username = v_old_uname;
  update public.pack_allowance              set username = v_new_uname where username = v_old_uname;
  update public.player_items                set username = v_new_uname where username = v_old_uname;
  update public.player_packs                set username = v_new_uname where username = v_old_uname;
  update public.player_progress             set username = v_new_uname where username = v_old_uname;
  update public.rebirth_daily               set username = v_new_uname where username = v_old_uname;
  update public.roll_history                set username = v_new_uname, user_id = v_new_uid where username = v_old_uname;
  update public.roll_ledger                 set username = v_new_uname, user_id = v_new_uid where username = v_old_uname;
  update public.rpc_guard                   set username = v_new_uname where username = v_old_uname;
  update public.rpc_rate                    set username = v_new_uname where username = v_old_uname;
  update public.stacks_legacy               set username = v_new_uname where username = v_old_uname;
  update public.stacks_legacy_5b3           set username = v_new_uname where username = v_old_uname;
  update public.story_progress              set username = v_new_uname where username = v_old_uname;
  update public.tamper_log                  set username = v_new_uname where username = v_old_uname;
  update public.token_daily                 set username = v_new_uname where username = v_old_uname;
  update public.tower_progress              set username = v_new_uname where username = v_old_uname;
  update public.world_boss_attempts         set username = v_new_uname where username = v_old_uname;
  update public.world_boss_milestone_claims set username = v_new_uname where username = v_old_uname;
  update public.world_boss_runs             set username = v_new_uname where username = v_old_uname;
  update public.xp_daily                    set username = v_new_uname where username = v_old_uname;

  update public.global_luck    set activated_by = v_new_uname where lower(activated_by) = v_old_uname;
  update public.global_weather set activated_by = v_new_uname where lower(activated_by) = v_old_uname;

  -- Terakhir, pindahkan row player_saves utama ke username, password hash, & uid baru.
  update public.player_saves
     set username   = v_new_uname,
         password   = p_new_password_hash,
         user_id    = v_new_uid,
         claimed_at = now(),
         updated_at = now()
   where username = v_old_uname
     and user_id  = v_tok_row.guest_uid;

  return jsonb_build_object(
    'ok', true,
    'username', v_new_uname,
    'old_username', v_old_uname,
    'save_data', v_src.save_data
  );
end;
$$;

revoke all on function public.issue_guest_claim() from public, anon;
grant execute on function public.issue_guest_claim() to authenticated, service_role;

revoke all on function public.complete_guest_claim(text, text, text) from public, anon;
grant execute on function public.complete_guest_claim(text, text, text) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
