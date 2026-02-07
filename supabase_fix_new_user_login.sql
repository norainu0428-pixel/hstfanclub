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

-- 2b. オーナーチェック用関数（RLS無限再帰を防ぐためSECURITY DEFINERでprofilesを直接参照）
CREATE OR REPLACE FUNCTION public.is_profile_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_profile_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_profile_owner() TO anon;

-- 2c. SELECTポリシー（無限再帰を修正: サブクエリでprofiles参照していたため）
DROP POLICY IF EXISTS "Users can view own profile and owners can view all" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile and owners can view all"
ON profiles FOR SELECT
USING (
  auth.uid() = user_id
  OR
  public.is_profile_owner()
);

-- 2d. UPDATEポリシー（同様に無限再帰を防止）
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  public.is_profile_owner()
);

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

-- 4. RPC関数（RLSをバイパスしてプロフィール取得 - セッション必須）
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon;

-- 4b. ポイント加算RPC（バトル勝利時など、RLSをバイパスしてポイントを加算）
CREATE OR REPLACE FUNCTION public.add_profile_points(points_to_add INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET points = GREATEST(0, COALESCE(points, 0) + points_to_add),
      updated_at = NOW()
  WHERE user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_profile_points(INTEGER) TO authenticated;

-- 5. 確認
SELECT '✅ 完了！' as status, 
       (SELECT COUNT(*) FROM auth.users) as auth_users,
       (SELECT COUNT(*) FROM profiles) as profiles;
SELECT 'プロフィールがないユーザー: ' || COUNT(*)::text as check_result
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = a.id);
