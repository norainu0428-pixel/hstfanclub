-- ========================================
-- フレンド名が「不明」になる問題の修正
-- Supabase SQL Editorで実行してください
-- ========================================
-- 原因: profiles の RLS で、他ユーザーのプロフィール行を SELECT できない
-- 対応:
--   1) フレンドのプロフィールを読めるポリシー（一覧・対戦など）
--   2) ログイン済みユーザーが他ユーザーのプロフィールを読めるポリシー
--      （プレイヤー検索・フレンド申請の送信者名表示に必要）
-- ========================================

-- 1. フレンドのプロフィールを閲覧可能
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

-- 2. ログイン済みなら他ユーザーのプロフィールを読める（検索・申請一覧用）
DROP POLICY IF EXISTS "Authenticated users can view profiles for search" ON profiles;
CREATE POLICY "Authenticated users can view profiles for search" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

SELECT '✅ フレンドの名前が表示されるようになりました' AS status;
