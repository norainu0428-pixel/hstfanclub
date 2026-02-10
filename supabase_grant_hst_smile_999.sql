-- 指定ユーザーに「HST Smile」Lv999 を画像のステータスで1体付与する
-- Supabase SQL Editor で実行してください
-- 元: HST Smile レベルMAX の実績値（HP 26434, ATK 6627, DEF 5290, SPD 5267）

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
  'smile',
  '🌟',
  'HSTesportsの笑顔を体現する最高位メンバー(レベルMAX)',
  'HST',
  999,
  0,
  26434,
  26434,
  26434,
  6627,
  5290,
  5267,
  'hst_power',
  0,
  false
);
