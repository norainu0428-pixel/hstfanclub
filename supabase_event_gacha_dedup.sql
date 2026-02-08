-- ========================================
-- イベントガチャ確率の重複除去
-- ガチャの確率表が2回表示される問題の修正用
-- Supabase SQL Editorで実行してください
-- ========================================

-- event_gacha_rates に重複がある場合、最新の1件のみ残す（id が大きい方を残す）
DELETE FROM event_gacha_rates a
USING event_gacha_rates b
WHERE a.id < b.id
  AND LOWER(TRIM(COALESCE(a.rarity, ''))) = LOWER(TRIM(COALESCE(b.rarity, '')));

SELECT '✅ イベントガチャの重複を除去しました。' AS status;
