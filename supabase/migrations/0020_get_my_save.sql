-- ============================================================
-- 0020_get_my_save.sql  —  AUTH JWT, FASE 2b (BACA SAVE VIA JWT)
--
-- PRASYARAT: 0018 (kolom user_id) + 0019 (link_player_auth) sudah jalan.
--
-- TUJUAN: client berhenti membaca player_saves lewat anon. Dua RPC definer
-- ini mengambil save MILIK PEMILIK TOKEN (auth.uid()) saja:
--   * get_my_save()        -> {ok, username, save_data, updated_at}
--   * get_my_session_id()  -> sid device (buat heartbeat multi-device)
--
-- KENAPA PERLU: heartbeat & pull saat masuk game tadinya SELECT anon
-- (username=eq.*), yang cuma bisa dipersempit kalau client punya identitas.
-- Dengan dua RPC ini, RLS boleh jadi owner-only (2c) tanpa memutus client.
--
-- Catatan efisiensi: get_my_session_id sengaja terpisah supaya heartbeat
-- tetap ±50 byte, bukan menarik save_data utuh (bisa 75 KB) tiap 30 detik.
-- Definisi definer = jalan sebagai owner, jadi tetap tembus RLS nanti,
-- TAPI hasilnya selalu difilter user_id = auth.uid() (tidak bocor ke anon:
-- anon tidak punya uid -> AUTH_REQUIRED / null).
-- ============================================================
begin;

create or replace function public.get_my_save() returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r     record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'AUTH_REQUIRED');
  end if;
  select username, save_data, updated_at into r
    from public.player_saves where user_id = v_uid limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'NO_SAVE');
  end if;
  return jsonb_build_object(
    'ok', true,
    'username', r.username,
    'save_data', r.save_data,
    'updated_at', r.updated_at);
end;
$$;

create or replace function public.get_my_session_id() returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.save_data ->> 'current_session_id'
    from public.player_saves s
   where s.user_id = auth.uid()
   limit 1;
$$;

revoke all on function public.get_my_save() from public;
revoke all on function public.get_my_session_id() from public;
grant execute on function public.get_my_save() to authenticated, service_role;
grant execute on function public.get_my_session_id() to authenticated, service_role;

commit;

-- ============================================================
-- VERIFIKASI:
--   -- tanpa token -> AUTH_REQUIRED
--   curl -X POST "$URL/rest/v1/rpc/get_my_save" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
--   -- dengan token user yang sudah tertaut -> {ok:true, username:...}
-- ============================================================
