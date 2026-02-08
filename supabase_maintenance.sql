-- メンテナンスモード設定テーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS maintenance_mode (
  id INT PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT false,
  message TEXT DEFAULT '只今メンテナンス中です。しばらくお待ちください。',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)
);

-- 初期データ
INSERT INTO maintenance_mode (id, enabled, message) VALUES (1, false, '只今メンテナンス中です。しばらくお待ちください。')
ON CONFLICT (id) DO NOTHING;

-- RLS 有効化
ALTER TABLE maintenance_mode ENABLE ROW LEVEL SECURITY;

-- 誰でも閲覧可能（ミドルウェアでメンテ中かチェックするため）
DROP POLICY IF EXISTS "Anyone can read maintenance mode" ON maintenance_mode;
CREATE POLICY "Anyone can read maintenance mode" ON maintenance_mode
  FOR SELECT USING (true);

-- オーナーのみ更新可能
DROP POLICY IF EXISTS "Owner can update maintenance mode" ON maintenance_mode;
CREATE POLICY "Owner can update maintenance mode" ON maintenance_mode
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );
