-- ===========================================================
-- WORLD BOSS — REBALANCE REWARD HARIAN (top 1/2/3 + partisipan)
-- Jalankan SETELAH 0009 di Supabase SQL Editor.
--
-- world_boss_bracket() adalah SATU-SATUNYA sumber angka reward:
-- dipakai oleh world_boss_state (preview 'yesterday') dan
-- claim_world_boss_reward (payout). Mengubah fungsi ini otomatis
-- menyelaraskan tampilan tombol klaim DAN hadiah yang benar-benar
-- diberikan — tanpa perlu menyentuh klien.
--
-- Skema baru (dulu: rank1 / 2-10 / 11-50 / 51-200 / partisipan≥1M):
--   #1          : 1.000 GEM · 10.000 TOKEN WB · 10× INSTAN PACK 100K · gelar APEX SLAYER
--   #2          :   500 GEM ·  5.000 TOKEN WB ·  5× INSTAN PACK 100K
--   #3          :   250 GEM ·  2.500 TOKEN WB ·  3× INSTAN PACK 100K
--   sisanya     :   100 GEM ·  1.000 TOKEN WB ·  1× INSTAN PACK 100K
--                 (semua yang punya skor kemarin, tanpa syarat damage minimum)
-- ===========================================================

create or replace function public.world_boss_bracket(p_rank integer, p_best bigint)
returns table (bracket text, gems integer, tokens integer, packs integer, title text)
language sql
immutable
as $$
  select
    case
      when p_rank is null then 'none'
      when p_rank = 1     then 'rank1'
      when p_rank = 2     then 'rank2'
      when p_rank = 3     then 'rank3'
      else 'participant'
    end,
    case                                   -- gems
      when p_rank = 1 then 1000
      when p_rank = 2 then 500
      when p_rank = 3 then 250
      when p_rank is null then 0
      else 100
    end,
    case                                   -- world boss tokens
      when p_rank = 1 then 10000
      when p_rank = 2 then 5000
      when p_rank = 3 then 2500
      when p_rank is null then 0
      else 1000
    end,
    case                                   -- instan roll 100k packs
      when p_rank = 1 then 10
      when p_rank = 2 then 5
      when p_rank = 3 then 3
      when p_rank is null then 0
      else 1
    end,
    case when p_rank = 1 then 'APEX SLAYER' else null end;
$$;

revoke all on function public.world_boss_bracket(integer, bigint) from public;
