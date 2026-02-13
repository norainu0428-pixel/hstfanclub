-- オーナー（profiles.role = 'owner'）に「覚醒STARY」Lv.9999（レベルMAX）を1体付与する
-- オーナーが1人である前提。複数オーナーがいる場合は全員に1体ずつ付与される。
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
)
SELECT
  p.user_id,
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
FROM profiles p
WHERE p.role = 'owner';
