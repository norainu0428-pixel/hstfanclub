-- フレンド機能の修正
-- Supabase SQL Editor で実行してください

-- 1. friendships の INSERT ポリシー
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- 2. profiles の SELECT ポリシー（フレンド検索用）
DROP POLICY IF EXISTS "Authenticated can read names for friend search" ON profiles;
CREATE POLICY "Authenticated can read names for friend search" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. handle_new_user トリガー（Discord global_name 対応）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'global_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  );
  IF v_display_name IS NULL AND NEW.email IS NOT NULL THEN
    v_display_name := split_part(NEW.email, '@', 1);
  END IF;
  IF v_display_name IS NULL THEN
    v_display_name := 'ユーザー';
  END IF;
  INSERT INTO public.profiles (user_id, display_name, role, points)
  VALUES (NEW.id, v_display_name, 'member', 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. フレンド検索用 RPC（profiles に membership_tier が無くても動く）
DROP FUNCTION IF EXISTS public.search_profiles_for_friends(text, uuid);
CREATE OR REPLACE FUNCTION public.search_profiles_for_friends(
  p_search_term text,
  p_exclude_user_id uuid
)
RETURNS TABLE (
  user_id uuid,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.user_id, COALESCE(p.display_name, '')
  FROM profiles p
  WHERE p.user_id != p_exclude_user_id
    AND (
      COALESCE(p.display_name, '') ILIKE '%' || p_search_term || '%'
      OR p.user_id::text ILIKE p_search_term || '%'
    )
  ORDER BY p.display_name NULLS LAST
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_profiles_for_friends(text, uuid) TO authenticated;
