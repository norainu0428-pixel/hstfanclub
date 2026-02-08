-- ========================================
-- フレンド機能の動作確認・修正
-- Supabase SQL Editorで実行してください
-- ========================================
-- 想定される問題:
-- 1. profiles:  player search で他ユーザーのプロフィールを読めない（RLS制限）
-- 2. friendships: 承認時に2行目(user_id=相手)のINSERTが失敗する（RLS制限）
-- 3. profiles: フレンド一覧で「不明」表示（フレンドのプロフィール参照不可）
-- ========================================

-- 1. profiles: ログイン済みユーザーがプレイヤー検索で他ユーザーのプロフィールを読めるようにする
DROP POLICY IF EXISTS "Authenticated users can search player profiles" ON profiles;
CREATE POLICY "Authenticated users can search player profiles" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. friendships: 承認時に双方向2行を作成できるようにする
--    （auth.uid() が user_id または friend_id のどちらかであれば INSERT 可能）
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- 3. profiles: フレンドのプロフィールを閲覧可能（friends_profiles_fix と同等）
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

-- last_seen_at が無い場合は追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. friend_requests: DELETE で sender が取り消し可能か確認（既存ポリシーで対応済みの想定）
-- 既存: auth.uid() = sender_id OR auth.uid() = receiver_id で OK

SELECT '✅ フレンド機能の修正スクリプトを実行しました。' AS status;
SELECT '次の手順: 1) プレイヤー検索で他ユーザーを検索 2) フレンド申請送信 3) 相手が承認 4) フレンド一覧に表示' AS next_steps;
