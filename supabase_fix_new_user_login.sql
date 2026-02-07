-- ========================================
-- 新規ユーザーがログインできるようにする完全修正
-- Supabase SQL Editorで実行してください
-- ========================================
-- 原因: 
-- 1. RLSポリシーでプロフィール作成が制限されている可能性
-- 2. handle_new_user トリガーが存在しない、またはプロフィールが未作成
-- ========================================

-- 1. トリガー関数を確保（新規ユーザー登録時にプロフィールを自動作成）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role, points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'ユーザー' END),
    'member',
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- エラーが発生してもauthの登録は続行
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. RLSポリシーを修正（新規ユーザーが自分でプロフィールを作成できるように）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. auth.usersに存在するがprofilesにいないユーザーにプロフィールを作成
INSERT INTO profiles (user_id, display_name, role, points)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', CASE WHEN email IS NOT NULL THEN split_part(email, '@', 1) ELSE 'ユーザー' END),
  'member',
  0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

-- 4. 確認
SELECT '✅ 完了！' as status, 
       (SELECT COUNT(*) FROM auth.users) as auth_users,
       (SELECT COUNT(*) FROM profiles) as profiles;
SELECT 'プロフィールがないユーザー: ' || COUNT(*)::text as check_result
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = a.id);
