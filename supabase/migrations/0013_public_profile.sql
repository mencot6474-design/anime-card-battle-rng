-- 0013_public_profile.sql
-- Profil PUBLIK player untuk leaderboard: foto avatar + ringkasan `pub`.
--
-- `pub` dibangun client dan ikut terkirim tiap cloud save (js/state.js
-- buildPubSummary), jadi server tidak perlu tahu rumus game. Fungsi di bawah
-- hanya membaca ulang key yang memang sengaja dibuka: TIDAK ada gems,
-- password, inventori, atau purchase history yang keluar lewat sini.
--
-- Jalankan manual di Supabase SQL Editor (CLI belum login).

-- ===== avatar (foto profil) banyak player sekaligus =====
-- Dipakai papan peringkat: client minta nama yang belum ada di cache lokalnya,
-- jadi biaya egress hanya sekali per player.
create or replace function public.get_player_avatars(p_usernames text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(t.username, jsonb_build_object('av', t.av)),
    '{}'::jsonb)
  from (
    select lower(s.username) as username,
           left(s.save_data->>'customAvatar', 24000) as av
      from public.player_saves s
     where s.save_data->>'customAvatar' like 'data:image/%'
       and lower(s.username) in (
             select lower(x) from unnest(coalesce(p_usernames, '{}'::text[])) as x
           )
  ) t;
$$;

-- ===== satu profil lengkap untuk sheet "lihat profil" =====
-- Player lama (save-nya belum ada key `pub`) tetap balikin data dengan `pub`
-- kosong — sheet menampilkan foto + "belum sinkron". NOT_FOUND hanya untuk
-- username yang memang tidak ada di player_saves; daftar nama toh sudah publik
-- lewat get_leaderboard, jadi syarat `pub` tidak menambah perlindungan apa-apa.
create or replace function public.get_player_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
               'ok', true,
               'username', lower(s.username),
               'pub', coalesce(s.save_data->'pub', '{}'::jsonb),
               'play', coalesce(nullif(s.save_data->>'playSec', '')::int, 0),
               'avatar', case when s.save_data->>'customAvatar' like 'data:image/%'
                              then left(s.save_data->>'customAvatar', 24000)
                              else null end,
               'updated_at', s.updated_at)
        from public.player_saves s
       where p_username is not null
         and lower(s.username) = lower(p_username)
    ),
    jsonb_build_object('ok', false, 'msg', 'NOT_FOUND'));
$$;

revoke all on function public.get_player_avatars(text[]) from public;
revoke all on function public.get_player_profile(text) from public;
grant execute on function public.get_player_avatars(text[]) to anon, authenticated, service_role;
grant execute on function public.get_player_profile(text) to anon, authenticated, service_role;

-- Verifikasi cepat:
-- select public.get_player_profile('USERNAME');
-- select public.get_player_avatars(array['USERNAME','LAINNYA']);
