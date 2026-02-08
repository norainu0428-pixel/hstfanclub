-- ========================================
-- HSTイベントガチャ用SQL
-- Supabase SQL Editorで実行してください
-- ========================================

-- ========================================
-- 1. HSTレアリティ追加（通常ガチャには出ない）
-- ========================================

-- プレミアムガチャ（確率0%）
INSERT INTO gacha_rates (rarity, rate, ten_pull_rate)
VALUES ('HST', 0, 0)
ON CONFLICT (rarity) DO UPDATE SET rate = 0, ten_pull_rate = 0;

-- 通常会員ガチャ（確率0%）
INSERT INTO basic_gacha_rates (rarity, rate, ten_pull_rate)
VALUES ('HST', 0, 0)
ON CONFLICT (rarity) DO UPDATE SET rate = 0, ten_pull_rate = 0;

-- ========================================
-- 2. イベントガチャ確率テーブル作成
-- ========================================

CREATE TABLE IF NOT EXISTS event_gacha_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rarity TEXT UNIQUE NOT NULL,
  rate DECIMAL(5, 2) NOT NULL,
  ten_pull_rate DECIMAL(5, 2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS設定
ALTER TABLE event_gacha_rates ENABLE ROW LEVEL SECURITY;

-- 全員が読める
DROP POLICY IF EXISTS "Anyone can view event gacha rates" ON event_gacha_rates;
CREATE POLICY "Anyone can view event gacha rates"
ON event_gacha_rates FOR SELECT
USING (true);

-- ownerのみ更新可能
DROP POLICY IF EXISTS "Only owner can update event gacha rates" ON event_gacha_rates;
CREATE POLICY "Only owner can update event gacha rates"
ON event_gacha_rates FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- ========================================
-- 3. イベントガチャ確率データ挿入
-- ========================================

INSERT INTO event_gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('HST', 0.1, 1.0),
  ('stary', 0.5, 5.0),
  ('legendary', 3.0, 10.0),
  ('ultra-rare', 10.0, 20.0),
  ('super-rare', 20.0, 64.0),
  ('rare', 30.0, 0.0),
  ('common', 36.4, 0.0)
ON CONFLICT (rarity) DO UPDATE SET rate = EXCLUDED.rate, ten_pull_rate = EXCLUDED.ten_pull_rate, updated_at = NOW();

-- ========================================
-- 確認用クエリ
-- ========================================

SELECT rarity, rate, ten_pull_rate 
FROM event_gacha_rates 
ORDER BY rate DESC;

-- 完了メッセージ
SELECT '✅ イベントガチャテーブル作成完了！HST確率: 単発0.1%、10連目1%' AS status;
