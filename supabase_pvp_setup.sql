-- PvP対戦テーブルとRLS
-- Supabase SQL Editor で実行してください（400 エラー対策）

-- テーブルが無い場合のみ作成
CREATE TABLE IF NOT EXISTS pvp_battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player1_party UUID[],
  player2_party UUID[],
  player1_hp JSONB DEFAULT '{}',
  player2_hp JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  turn_number INTEGER DEFAULT 0,
  current_turn_player UUID REFERENCES auth.users(id),
  battle_log TEXT[] DEFAULT '{}',
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS 有効化
ALTER TABLE pvp_battles ENABLE ROW LEVEL SECURITY;

-- 参加者（player1 または player2）は SELECT 可能
DROP POLICY IF EXISTS "Players can view own battles" ON pvp_battles;
CREATE POLICY "Players can view own battles" ON pvp_battles
  FOR SELECT USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

-- player1 が新規作成（INSERT）
DROP POLICY IF EXISTS "Player1 can create battle" ON pvp_battles;
CREATE POLICY "Player1 can create battle" ON pvp_battles
  FOR INSERT WITH CHECK (auth.uid() = player1_id);

-- 参加者（player1 または player2）は UPDATE 可能（参加・ターン・結果）
DROP POLICY IF EXISTS "Players can update own battles" ON pvp_battles;
CREATE POLICY "Players can update own battles" ON pvp_battles
  FOR UPDATE USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

-- 既存テーブルに created_at が無い場合は追加（エラーになる場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pvp_battles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE pvp_battles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
