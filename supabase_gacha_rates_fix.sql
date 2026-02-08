-- ========================================
-- ガチャ確率の修正
-- ・Basic: 10連目はスーパーレア以上確定（stary,legendary,ultra-rare,super-rareの合計100%）
-- ・Premium: 10連目はレア以上確定（同上+rareの合計100%）
-- ・HSTはBasic/Premiumでは0%（イベントガチャのみ）
-- Supabase SQL Editorで実行してください
-- ========================================

-- Basicガチャ: 10連目はスーパーレア以上確定（4種で100%）
INSERT INTO basic_gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.1, 1.0),
  ('legendary', 1.0, 5.0),
  ('ultra-rare', 3.0, 15.0),
  ('super-rare', 10.0, 79.0),
  ('rare', 30.0, 0.0),
  ('common', 55.9, 0.0),
  ('HST', 0, 0)
ON CONFLICT (rarity) DO UPDATE SET rate = EXCLUDED.rate, ten_pull_rate = EXCLUDED.ten_pull_rate, updated_at = NOW();

-- Premiumガチャ: 10連目はレア以上確定（5種で100%、commonは0%）
INSERT INTO gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.5, 2.0),
  ('legendary', 2.0, 8.0),
  ('ultra-rare', 5.0, 15.0),
  ('super-rare', 15.0, 25.0),
  ('rare', 30.0, 50.0),
  ('common', 47.5, 0.0),
  ('HST', 0, 0)
ON CONFLICT (rarity) DO UPDATE SET rate = EXCLUDED.rate, ten_pull_rate = EXCLUDED.ten_pull_rate, updated_at = NOW();

SELECT '✅ ガチャ確率を修正しました' AS status;
