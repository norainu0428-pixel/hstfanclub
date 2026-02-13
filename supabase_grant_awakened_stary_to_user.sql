-- さっきのユーザー（7d2ffd6b）に「覚醒STARY」Lv.1 を1体付与する
-- スキル: HST始動（1ターン無敵・防御+50000・相手3体即死）
-- アビリティ: 敵の即死無効化・自分を攻撃した敵に2000ダメージ
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
  '7d2ffd6b-79fc-409e-afa1-24e69d0e6a04',
  '覚醒STARY',
  '🌠',
  '覚醒した伝説のマスコット',
  '覚醒',
  1,
  0,
  1500,
  1500,
  1500,
  500,
  250,
  180,
  'hst_start',
  0,
  false
);
