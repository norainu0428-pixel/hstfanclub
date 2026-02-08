-- ========================================
-- ランキングを「最高到達ステージ」で表示するための設定
-- Supabase SQL Editorで実行してください
-- ========================================
-- ランキングページで user_progress を全ユーザー分読むため、
-- ログイン済みユーザーが user_progress を SELECT できるポリシーを追加します。
-- （既存の「自分のみ」ポリシーと OR で評価され、ランキング用に全件取得可能になります）
-- ========================================

DROP POLICY IF EXISTS "Anyone authenticated can view progress for ranking" ON user_progress;
CREATE POLICY "Anyone authenticated can view progress for ranking" ON user_progress
  FOR SELECT USING (auth.uid() IS NOT NULL);

SELECT '✅ ランキング（最高到達ステージ）用のポリシーを追加しました' AS status;
