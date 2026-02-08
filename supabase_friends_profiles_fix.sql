-- ========================================
-- フレンド一覧「不明」表示の修正
-- 原因: profiles の RLS でフレンドのプロフィールを参照できない
-- Supabase SQL Editorで実行してください
-- ========================================

-- profiles の SELECT に「フレンドのプロフィールを閲覧可能」を追加
DROP POLICY IF EXISTS "Users can view friends profiles" ON profiles;
CREATE POLICY "Users can view friends profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE (
        (f.user_id = auth.uid() AND f.friend_id = profiles.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = profiles.user_id)
      )
      AND f.status = 'accepted'
    )
  );

-- last_seen_at が無い場合は追加（最終オンライン表示用）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ;
  END IF;
END $$;

SELECT '✅ フレンド一覧のプロフィール表示が修正されました。' AS status;
