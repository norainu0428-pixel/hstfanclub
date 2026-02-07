-- フレンド機能の修正
-- Supabase SQL Editorで実行してください
--
-- 1. friendships の INSERT を「自分が user_id または friend_id のとき」許可する
--    → 申請承認時に双方向2件を挿入できる
-- 2. フレンド検索で他ユーザーの表示名を読めるように profiles の SELECT を緩和（任意）

-- friendships: 申請承認者が (自分,相手) と (相手,自分) の2件を挿入できるようにする
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- フレンド検索: 認証済みユーザーが他ユーザーの表示名を読めるようにする
DROP POLICY IF EXISTS "Authenticated can read names for friend search" ON profiles;
CREATE POLICY "Authenticated can read names for friend search" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Discord の global_name を display_name に反映する（既存トリガー更新）
-- Discord OAuth では full_name/name の他に global_name が表示名の場合がある
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role, points)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'global_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      CASE WHEN NEW.email IS NOT NULL THEN split_part(NEW.email, '@', 1) ELSE 'ユーザー' END
    ),
    'member',
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 既存ユーザー: Discord の global_name が未反映なら更新（要・再ログインで raw_user_meta_data が更新される前提）
-- 以下は手動で実行する場合: auth.users の raw_user_meta_data を参照して profiles を更新
/*
UPDATE profiles p
SET display_name = COALESCE(
  (SELECT raw_user_meta_data->>'global_name' FROM auth.users u WHERE u.id = p.user_id),
  p.display_name
)
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id AND u.raw_user_meta_data->>'global_name' IS NOT NULL);
*/
