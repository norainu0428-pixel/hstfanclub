-- 経験値アップコース（レベルアップステージ）の残り回数をオーナーが操作する用
-- profiles にボーナス回数を追加。1日5回 + この値が「残り回数」になる。
-- Supabase SQL Editor で一度だけ実行してください

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS level_training_bonus_plays INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.level_training_bonus_plays IS 'レベルアップステージのボーナス挑戦回数（オーナーが設定。基本5回/日に加算される）';
