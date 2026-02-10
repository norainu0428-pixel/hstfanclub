-- 指定ユーザーに「HST riemu（既存キャラ）」のレベル最大版を1体付与する
-- Supabase SQL Editor で実行してください
-- メモ:
-- - HST レアリティの最大レベルは MAX_LEVELS['HST'] = 200 を想定
-- - ステータス値は「高めだがゲームバランス範囲内」のイメージで設定しています

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
  'def6fc15-da15-4f13-8534-6c425bb68c50', -- 付与先ユーザーID
  'riemu',                                -- 既存のRiemuキャラ
  '🌟',
  'HST Riemu（レベル最大）',
  'HST',                                  -- HSTレアリティ
  200,                                    -- HSTの最大レベル
  0,                                      -- 必要に応じて後から経験値調整
  3500,                                   -- HP（高め）
  3500,
  3500,
  220,                                    -- 攻撃
  140,                                    -- 防御
  120,                                    -- 速度
  'riemu_blessing',                       -- 既存のRiemuスキル
  0,
  false
);

