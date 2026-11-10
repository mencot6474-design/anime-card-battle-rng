-- 0044_trait_odds_update.sql — Sync trait_def rates with js/cards-fx.js TRAIT_TIERS
-- Demi-God 0.1%, Cosmic 0.05%, BigBang 0.01%, Transiden 0.34% (sum remains 100.000%).

insert into public.trait_def (k, atk, hp, chance, color, rar, fx, ord) values
  ('transiden', 2,   1.5, 0.34, '#F6DFA6', 'UR',  '{}', 5),
  ('demigod',   3,   1.5, 0.1,  '#FF4D5E', 'EX',  '{}', 6),
  ('cosmic',    3.5, 3.5, 0.05, '#E56BFF', 'COS', '{}', 7),
  ('bigbang',   5,   4,   0.01, '#7DF9FF', 'BB',  '{}', 8)
on conflict (k) do update set
  chance = excluded.chance;
