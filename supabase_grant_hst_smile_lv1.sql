-- 指定ユーザーに「HST smile」Lv.1 を1体付与する
-- Supabase SQL Editor で実行してください
-- ステータス: types/adventure.ts の INITIAL_STATS['HST'] 準拠

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
  '7d2ffd6b-79fc-409e-afa1-24e69d0e6a04',
  'smile',
  '🌟',
  'HSTesportsの笑顔を体現する最高位メンバー',
  'HST',
  1,
  0,
  300,
  300,
  300,
  100,
  50,
  60,
  'hst_power',
  0,
  false
);
