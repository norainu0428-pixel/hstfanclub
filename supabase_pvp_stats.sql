-- PvPランキング用テーブル
-- Supabase SQL Editorで実行してください

CREATE TABLE IF NOT EXISTS pvp_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE pvp_stats ENABLE ROW LEVEL SECURITY;

-- 全員が読める（ランキング表示用）
DROP POLICY IF EXISTS "Anyone can read pvp_stats" ON pvp_stats;
CREATE POLICY "Anyone can read pvp_stats" ON pvp_stats
  FOR SELECT USING (true);

-- 自分のレコードのみ更新可能（RPCで更新）
DROP POLICY IF EXISTS "Users can update own pvp_stats" ON pvp_stats;
CREATE POLICY "Users can update own pvp_stats" ON pvp_stats
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pvp_stats" ON pvp_stats;
CREATE POLICY "Users can insert own pvp_stats" ON pvp_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- バトル結果更新用RPC（SECURITY DEFINERでRLSをバイパス）
CREATE OR REPLACE FUNCTION update_pvp_stats(p_user_id UUID, p_won BOOLEAN)
RETURNS void AS $$
BEGIN
  INSERT INTO pvp_stats (user_id, rating, wins, losses, total_battles, updated_at)
  VALUES (p_user_id, 1000, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    wins = CASE WHEN p_won THEN pvp_stats.wins + 1 ELSE pvp_stats.wins END,
    losses = CASE WHEN NOT p_won THEN pvp_stats.losses + 1 ELSE pvp_stats.losses END,
    total_battles = pvp_stats.total_battles + 1,
    rating = CASE 
      WHEN p_won THEN LEAST(3000, pvp_stats.rating + 25)
      ELSE GREATEST(100, pvp_stats.rating - 25)
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
