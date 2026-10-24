-- ===========================================================
-- HEMAT BANDWIDTH — merge_player_state bisa menahan inventori
--
-- Latar: client mengirim seluruh save_data (±110 KB, grib ±16 KB) tiap 5 detik
-- selama auto-roll. Isi terbesarnya `stacks`. Dengan p_skip_stacks = true,
-- server mempertahankan `stacks` yang tersimpan dan hanya menimpa field lain
-- (koin, token, gem, progres). Client tetap mengirim inventori penuh saat roll
-- berhenti, jadi tidak ada kartu yang hilang.
--
-- Tambahan parameter membuat signature lama ambigu (4 vs 5 arg dengan default),
-- jadi fungsi 4-argumen di-drop dulu. Pemanggil lama yang masih mengirim 4
-- named argumen tetap cocok ke versi baru ini (p_skip_stacks default false).
--
-- Jalankan di Supabase SQL Editor.
-- ===========================================================

drop function if exists public.merge_player_state(text, text, jsonb, boolean);

create or replace function public.merge_player_state(
  p_username text,
  p_password_hash text,
  p_save_data jsonb,
  p_allow_gem_decrease boolean default false,
  p_skip_stacks boolean default false
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
  old_save  jsonb;
begin
  if p_username is null or p_save_data is null then
    raise exception 'BAD_INPUT';
  end if;

  select coalesce(nullif(save_data->>'premiumGems','')::integer, 0), password, save_data
    into cur_gems, stored_pw, old_save
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
  if p_allow_gem_decrease and new_gems < cur_gems then
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(new_gems), true);
  else
    merged := jsonb_set(p_save_data, '{premiumGems}', to_jsonb(cur_gems), true);
  end if;

  -- Inventori ditahan kalau client minta (push ringan saat auto-roll).
  if p_skip_stacks then
    merged := jsonb_set(merged, '{stacks}', coalesce(old_save->'stacks', '[]'::jsonb), true);
  end if;

  update public.player_saves
     set save_data = merged, updated_at = now()
   where username = lower(p_username);

  return jsonb_build_object('ok', true, 'premiumGems',
    coalesce(nullif(merged->>'premiumGems','')::integer, cur_gems));
end;
$$;

revoke all on function public.merge_player_state(text, text, jsonb, boolean, boolean) from public;
grant execute on function public.merge_player_state(text, text, jsonb, boolean, boolean) to anon, authenticated, service_role;
