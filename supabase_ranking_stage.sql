-- ランキングに最高クリアステージを表示するためのSQL
-- Supabase SQL Editor で実行してください

-- user_progress の current_stage をランキング用に読めるようにする
-- （認証済みユーザーが他ユーザーの current_stage を参照可能にする）
DROP POLICY IF EXISTS "Authenticated can read progress for ranking" ON user_progress;
CREATE POLICY "Authenticated can read progress for ranking" ON user_progress
  FOR SELECT USING (auth.role() = 'authenticated');
