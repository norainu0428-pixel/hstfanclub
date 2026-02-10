-- HST Riemu イベントステージ用 クリア記録テーブル
-- Supabase SQL Editor で一度だけ実行してください

CREATE TABLE IF NOT EXISTS riemu_event_clears (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,          -- 3001〜3006
  rarity TEXT NOT NULL,            -- 付与したレアリティ
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_riemu_event_clears_user
  ON riemu_event_clears(user_id);

ALTER TABLE riemu_event_clears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own riemu clears" ON riemu_event_clears;
CREATE POLICY "Users can view own riemu clears" ON riemu_event_clears
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own riemu clears" ON riemu_event_clears;
CREATE POLICY "Users can insert own riemu clears" ON riemu_event_clears
  FOR INSERT WITH CHECK (auth.uid() = user_id);

