-- ========================================
-- PvPリアルタイム対戦用テーブル
-- Supabase SQL Editorで実行してください
-- ========================================

CREATE TABLE IF NOT EXISTS pvp_battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player1_party UUID[] NOT NULL DEFAULT '{}',
  player2_party UUID[] DEFAULT '{}',
  player1_hp JSONB DEFAULT '{}',
  player2_hp JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  turn_number INTEGER DEFAULT 0,
  current_turn_player UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  battle_log TEXT[] DEFAULT '{}',
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  battle_buffs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 既存テーブルに battle_buffs を追加（スキル効果用）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pvp_battles' AND column_name = 'battle_buffs'
  ) THEN
    ALTER TABLE pvp_battles ADD COLUMN battle_buffs JSONB DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_battles_player1 ON pvp_battles(player1_id);
CREATE INDEX IF NOT EXISTS idx_pvp_battles_player2 ON pvp_battles(player2_id);
CREATE INDEX IF NOT EXISTS idx_pvp_battles_status ON pvp_battles(status);
CREATE INDEX IF NOT EXISTS idx_pvp_battles_created ON pvp_battles(created_at DESC);

ALTER TABLE pvp_battles ENABLE ROW LEVEL SECURITY;

-- 参加者（player1 or player2）のみ閲覧・更新可能
DROP POLICY IF EXISTS "Players can view own pvp_battles" ON pvp_battles;
CREATE POLICY "Players can view own pvp_battles" ON pvp_battles
  FOR SELECT USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

DROP POLICY IF EXISTS "Player1 can insert pvp_battles" ON pvp_battles;
CREATE POLICY "Player1 can insert pvp_battles" ON pvp_battles
  FOR INSERT WITH CHECK (auth.uid() = player1_id);

DROP POLICY IF EXISTS "Players can update own pvp_battles" ON pvp_battles;
CREATE POLICY "Players can update own pvp_battles" ON pvp_battles
  FOR UPDATE USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

-- Realtime を有効化（Supabase Dashboard → Database → Replication で pvp_battles にチェックを入れる必要がある場合もあり）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'pvp_battles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pvp_battles;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- 既に追加済みや環境差でエラーになる場合は無視
END $$;

SELECT '✅ pvp_battles テーブル作成完了！リアルタイム対戦が利用可能になりました。' AS status;
