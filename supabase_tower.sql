-- 覇者の塔（Tower of Conquerors）用テーブル
-- Supabase SQL Editor で一度だけ実行してください

CREATE TABLE IF NOT EXISTS tower_clears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,          -- 1〜100階
  stage INTEGER NOT NULL,          -- 対応する内部ステージID（2001〜2100）
  week_start DATE NOT NULL,        -- その週の開始日（月曜など）
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, floor, week_start)
);

CREATE INDEX IF NOT EXISTS idx_tower_clears_user_week
  ON tower_clears(user_id, week_start);

ALTER TABLE tower_clears ENABLE ROW LEVEL SECURITY;

-- 自分の塔クリア情報のみ参照・登録可能
DROP POLICY IF EXISTS "Users can view own tower clears" ON tower_clears;
CREATE POLICY "Users can view own tower clears" ON tower_clears
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tower clears" ON tower_clears;
CREATE POLICY "Users can insert own tower clears" ON tower_clears
  FOR INSERT WITH CHECK (auth.uid() = user_id);

