-- ===========================================================
-- WORLD BOSS — helper pool 1T yang hilang
--
-- 0007_world_boss_pool.sql tidak pernah dijalankan di project live,
-- padahal 0008/0009 memakai public.world_boss_pool_size() di dalam
-- submit_world_boss_run -> "function ... does not exist".
--
-- Sengaja HANYA fungsi ini yang dibuat. Menjalankan 0007 utuh setelah
-- 0009 akan mengembalikan world_boss_day_info(date) dan
-- world_boss_state(text, text) versi single-boss -> bentrok/ambigu
-- dengan versi ber-p_boss dari 0009.
--
-- Kolom hp_pool / hp_left / boss_id sudah ada dari 0005 + 0009, dan
-- world_boss_day_info() versi 0009 sudah mengisi pool-nya sendiri.
-- Jalankan SETELAH 0009.
-- ===========================================================

create or replace function public.world_boss_pool_size()
returns bigint
language sql
immutable
as $$
  select 1000000000000::bigint;
$$;

revoke all on function public.world_boss_pool_size() from public;
grant execute on function public.world_boss_pool_size() to anon, authenticated, service_role;
