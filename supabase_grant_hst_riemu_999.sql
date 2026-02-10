-- 指定ユーザーに「HST Riemu」Lv999 を1体付与する
-- Supabase SQL Editor で実行してください
-- ステータスは HST Smile Lv999 と同じ水準（HP 26434, ATK 6627, DEF 5290, SPD 5267）

INSERT INTO user_members (
  user_id,
  member_name,
  member_emoji,
  member_description,
  rarity,
  level,
  experience,
  hp,
  max_hp,
  current_hp,
  attack,
  defense,
  speed,
  skill_type,
  skill_power,
  revive_used
) VALUES (
  'def6fc15-da15-4f13-8534-6c425bb68c50',
  'riemu',
  '🌟',
  'HST Riemu（レベルMAX）',
  'HST',
  999,
  0,
  26434,
  26434,
  26434,
  6627,
  5290,
  5267,
  'riemu_blessing',
  0,
  false
);
