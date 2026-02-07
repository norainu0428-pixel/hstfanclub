-- ========================================
-- プロフィール作成を修正するRLSポリシー
-- オーナー以外のユーザーもログインできるようにする
-- Supabase SQL Editorで実行してください
-- ========================================

-- profilesテーブルのRLSを有効化（既に有効な場合はスキップ）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 既存のINSERTポリシーを削除
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 新しいINSERTポリシーを作成
-- 新規ユーザーが自分のプロフィールを作成できるようにする
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (
  -- 自分自身のプロフィールを作成できる（新規ユーザーも含む）
  auth.uid() = user_id
);

-- 既存のSELECTポリシーを確認・修正（オーナーが全ユーザーのプロフィールを見れるように）
DROP POLICY IF EXISTS "Users can view own profile and owners can view all" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
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
SELECT '✅ プロフィール作成ポリシーを修正しました！新規ユーザーもログインできるようになりました！' AS status;
