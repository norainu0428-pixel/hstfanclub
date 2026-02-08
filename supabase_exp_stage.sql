-- 経験値アップステージ用テーブル（1日5回までクリア可能）
-- Supabase SQL Editorで実行してください

CREATE TABLE IF NOT EXISTS exp_stage_clears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clear_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clear_count INTEGER DEFAULT 0 CHECK (clear_count >= 0 AND clear_count <= 5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, clear_date)
);

CREATE INDEX IF NOT EXISTS idx_exp_stage_clears_user_date ON exp_stage_clears(user_id, clear_date);

ALTER TABLE exp_stage_clears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exp stage clears" ON exp_stage_clears;
CREATE POLICY "Users can view own exp stage clears" ON exp_stage_clears
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own exp stage clears" ON exp_stage_clears;
CREATE POLICY "Users can insert own exp stage clears" ON exp_stage_clears
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exp stage clears" ON exp_stage_clears;
CREATE POLICY "Users can update own exp stage clears" ON exp_stage_clears
  FOR UPDATE USING (auth.uid() = user_id);
