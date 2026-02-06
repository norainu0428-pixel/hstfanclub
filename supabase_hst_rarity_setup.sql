-- HSTレアリティ追加用SQL
-- Supabase SQL Editorで実行してください

-- ========================================
-- HST レアリティ追加
-- ========================================

-- 1. ガチャ確率テーブルに追加（確率0%）
-- 注意: gacha_ratesテーブルが存在する場合のみ実行
INSERT INTO gacha_rates (rarity, rate, ten_pull_rate)
SELECT 'HST', 0, 0
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gacha_rates')
ON CONFLICT (rarity) DO UPDATE SET rate = 0, ten_pull_rate = 0;

-- 2. Basic会員ガチャ確率にも追加（確率0%）
-- 注意: basic_gacha_ratesテーブルが存在する場合のみ実行
INSERT INTO basic_gacha_rates (rarity, rate, ten_pull_rate)
SELECT 'HST', 0, 0
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'basic_gacha_rates')
ON CONFLICT (rarity) DO UPDATE SET rate = 0, ten_pull_rate = 0;

-- ========================================
-- 確認用クエリ
-- ========================================

-- 追加されたか確認（テーブルが存在する場合のみ）
SELECT 'gacha_rates' AS table_name, * FROM gacha_rates WHERE rarity = 'HST'
UNION ALL
SELECT 'basic_gacha_rates' AS table_name, * FROM basic_gacha_rates WHERE rarity = 'HST';

-- 完了メッセージ
SELECT 'HST レアリティが追加されました！（確率0%でガチャには出現しません）' AS status;
