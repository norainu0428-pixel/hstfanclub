-- ========================================
-- フレンド機能の修正
-- Supabase SQL Editorで実行してください
-- ========================================
-- 修正内容:
-- 1. friendships の INSERT ポリシーを変更し、承認時に双方向の行を作成可能にする
--    （auth.uid() が user_id または friend_id のどちらかであれば INSERT 可能）
-- ========================================

DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.uid() = friend_id
  );
