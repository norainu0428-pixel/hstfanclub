-- システム設定テーブル（メンテナンスモード等）
-- Supabase SQL Editorで実行してください

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 初期データ: メンテナンスモード OFF
INSERT INTO system_settings (key, value, updated_at)
VALUES ('maintenance_mode', '{"enabled": false}', NOW())
ON CONFLICT (key) DO NOTHING;

-- 全員が読み取り可能（メンテナンスチェック用）
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system_settings" ON system_settings;
CREATE POLICY "Anyone can read system_settings" ON system_settings
  FOR SELECT USING (true);

-- オーナーのみ更新可能
DROP POLICY IF EXISTS "Only owner can update system_settings" ON system_settings;
CREATE POLICY "Only owner can update system_settings" ON system_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Only owner can insert system_settings" ON system_settings;
CREATE POLICY "Only owner can insert system_settings" ON system_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'owner'
    )
  );
