-- プロフィール編集機能（表示名・アバター画像）
-- Supabase SQL Editor で実行してください

-- 1. profiles に avatar_url カラムを追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Storage バケット作成（avatars）
-- ※ SQL で失敗する場合は、Dashboard → Storage → New bucket で
--    id=avatars, public=true で手動作成してください
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage RLS: 認証ユーザーは自分のフォルダにのみアップロード可能
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Storage RLS: 誰でもアバター画像を閲覧可能（public bucket）
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- 5. Storage RLS: 認証ユーザーは自分のファイルのみ削除・更新可能
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK ((storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. フレンド検索 RPC に avatar_url を追加（search_profiles_for_friends が存在する場合）
DROP FUNCTION IF EXISTS public.search_profiles_for_friends(text, uuid);
CREATE OR REPLACE FUNCTION public.search_profiles_for_friends(
  p_search_term text,
  p_exclude_user_id uuid
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text
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
  SELECT p.user_id, COALESCE(p.display_name, ''), p.avatar_url
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
