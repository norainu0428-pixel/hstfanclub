-- ========================================
-- イベントガチャ確率の修正
-- 合計100%に修正し、STARYを含める
-- Supabase SQL Editorで実行してください
-- ========================================

-- 正しい確率で上書き（合計100%、STARY含む）
-- 既存の7種を削除してから挿入（重複・不正値を確実に解消）
DELETE FROM event_gacha_rates WHERE LOWER(TRIM(rarity)) IN ('hst','stary','legendary','ultra-rare','super-rare','rare','common');

INSERT INTO event_gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('HST', 0.1, 1.0),
  ('stary', 0.5, 5.0),
  ('legendary', 3.0, 10.0),
  ('ultra-rare', 10.0, 20.0),
  ('super-rare', 20.0, 64.0),
  ('rare', 30.0, 0.0),
  ('common', 36.4, 0.0);

SELECT '✅ イベントガチャ確率を修正しました（単発・10連目ともに合計100%、STARY含む）' AS status;
