-- 指定ユーザー（def6fc15）に「覚醒STARY」Lv.9999（レベルMAX）を1体付与する
-- ステータス: INITIAL_STATS['覚醒'] + 9998 × LEVEL_UP_STATS['覚醒']
-- Supabase SQL Editor で実行してください。

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
  '覚醒STARY',
  '🌠',
  '覚醒した伝説のマスコット（レベルMAX）',
  '覚醒',
  9999,
  0,
  101480,
  101480,
  101480,
  104980,
  80234,
  80164,
  'hst_start',
  0,
  false
);
