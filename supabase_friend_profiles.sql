-- フレンド一覧用プロフィール取得
-- Supabase SQL Editor で実行してください
-- RPC の代わりに RLS ポリシーでフレンドのプロフィール読み取りを許可

-- last_seen_at, avatar_url が無い場合に追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 既存の SELECT ポリシーを確認し、フレンドのプロフィール読み取りを追加
-- ※ 既存ポリシー「Users can view own profile and owners can view all」がある場合、
--    以下のポリシーを追加するか、既存ポリシーに OR 条件でマージしてください

-- フレンドのプロフィールを読めるようにする（既存の own/owner ポリシーに追加）
DROP POLICY IF EXISTS "Users can read friend profiles" ON profiles;
CREATE POLICY "Users can read friend profiles" ON profiles
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
