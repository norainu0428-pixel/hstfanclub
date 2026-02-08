-- ========================================
-- 新規ユーザー登録時にプロフィールを自動作成するトリガー
-- ========================================
-- 実装内容:
-- ・auth.users にINSERTされたら profiles に1行自動作成
-- ・display_name は Discord の full_name / global_name / name / email から取得
-- ・これがないと「一部のメンバーがログインできない」原因になる
-- ・末尾で既存の auth.users のうち profiles がないユーザーにも一括でプロフィール作成
-- Supabase SQL Editorで実行してください
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role, points)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'global_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    'member',
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 既存のauth.usersでプロフィールがないユーザーに作成
INSERT INTO public.profiles (user_id, display_name, role, points)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'global_name',
    raw_user_meta_data->>'name',
    CASE WHEN email IS NOT NULL THEN split_part(email, '@', 1) ELSE NULL END,
    'ユーザー'
  ),
  'member',
  0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;
