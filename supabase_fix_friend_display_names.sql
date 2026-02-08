-- ========================================
-- フレンド名が「不明」になる問題の修正
-- Supabase SQL Editorで実行してください
-- ========================================
-- 原因: profiles の RLS で、フレンドのプロフィール行を SELECT できない
-- 対応: フレンド（friendships で accepted）のプロフィールを読めるポリシーを追加
-- ========================================

DROP POLICY IF EXISTS "Users can view friends profiles" ON profiles;
CREATE POLICY "Users can view friends profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = profiles.user_id)
          OR (f.friend_id = auth.uid() AND f.user_id = profiles.user_id)
        )
    )
  );

SELECT '✅ フレンドの名前が表示されるようになりました' AS status;
