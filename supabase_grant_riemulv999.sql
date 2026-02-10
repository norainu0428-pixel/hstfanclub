-- 指定ユーザーに「riemulv999」を1体付与する
-- Supabase SQL Editor で実行してください

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
  'riemulv999',
  '🌟',
  'Riemu Lv999（管理者付与）',
  'HST',
  999,
  0,
  9999,
  9999,
  9999,
  500,
  200,
  150,
  'riemu_blessing',
  0,
  false
);
