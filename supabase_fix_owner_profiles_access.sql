-- ========================================
-- オーナーが全ユーザーのプロフィールを読み取れるようにするRLSポリシー修正
-- Supabase SQL Editorで実行してください
-- ========================================

-- profilesテーブルのRLSを有効化（既に有効な場合はスキップ）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 既存のSELECTポリシーを削除（念のため）
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Owners can view all profiles" ON profiles;

-- 新しいSELECTポリシーを作成
-- 1. 自分自身のプロフィールは誰でも見れる
-- 2. オーナーは全ユーザーのプロフィールを見れる
CREATE POLICY "Users can view own profile and owners can view all"
ON profiles FOR SELECT
USING (
  -- 自分自身のプロフィール
  auth.uid() = user_id
  OR
  -- オーナーは全ユーザーのプロフィールを見れる
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- 既存のUPDATEポリシーを確認・修正
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (
  -- 自分自身のプロフィール
  auth.uid() = user_id
  OR
  -- オーナーは全ユーザーのプロフィールを更新できる
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- 既存のINSERTポリシーを確認・修正
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (
  -- 自分自身のプロフィール
  auth.uid() = user_id
  OR
  -- オーナーは全ユーザーのプロフィールを挿入できる
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'owner'
  )
);

-- ========================================
-- 確認用クエリ
-- ========================================

-- 現在のRLSポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 完了メッセージ
SELECT '✅ オーナーが全ユーザーのプロフィールを読み取れるようになりました！' AS status;
