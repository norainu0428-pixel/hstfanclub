-- ランキングに最高クリアステージを表示するためのSQL
-- Supabase SQL Editor で実行してください

-- 1. user_progress の current_stage をランキング用に読めるようにする
DROP POLICY IF EXISTS "Authenticated can read progress for ranking" ON user_progress;
CREATE POLICY "Authenticated can read progress for ranking" ON user_progress
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. pvp_stats が無い場合のテーブル作成と RLS（ランキング表示用）
CREATE TABLE IF NOT EXISTS pvp_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvp_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pvp stats for ranking" ON pvp_stats;
CREATE POLICY "Anyone can view pvp stats for ranking" ON pvp_stats
  FOR SELECT USING (true);
