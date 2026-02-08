-- フレンド一覧用プロフィール取得
-- Supabase SQL Editor で実行してください
-- RPC の代わりに RLS ポリシーでフレンドのプロフィール読み取りを許可

-- last_seen_at, avatar_url が無い場合に追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 既存の SELECT ポリシーを確認し、フレンドのプロフィール読み取りを追加
-- ※ 既存ポリシー「Users can view own profile and owners can view all」がある場合、
--    以下のポリシーを追加するか、既存ポリシーに OR 条件でマージしてください

-- 認証済みユーザーはプロフィールを読める（フレンド一覧・検索用）
DROP POLICY IF EXISTS "Users can read friend profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles for friends" ON profiles;
CREATE POLICY "Authenticated can read profiles for friends" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
