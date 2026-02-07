-- ========================================
-- メンバーにロック機能を追加（合成に使えないようにする）
-- Supabase SQL Editorで実行してください
-- ========================================

ALTER TABLE user_members ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;

SELECT '✅ ロック機能を追加しました' AS status;
