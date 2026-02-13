-- テスト用: 指定ユーザーに「覚醒STARY」Lv.1 を1体付与する
-- レアリティ: 覚醒 / Lv.1 ステータス: HP1500 ATK500 DEF250 SPD180
-- ユーザーにはコレクション・パーティ選択で非表示。ガチャにも出ない。
-- Supabase SQL Editor で実行し、USER_ID を置き換えてください。

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
  'USER_ID',  -- ここをテスト用ユーザーのUUIDに置き換え
  '覚醒STARY',
  '🌠',
  '覚醒した伝説のマスコット（テスト用）',
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
