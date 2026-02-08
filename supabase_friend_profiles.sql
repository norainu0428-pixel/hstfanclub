-- フレンド一覧用プロフィール取得 RPC
-- Supabase SQL Editor で実行してください
-- フレンドの display_name, avatar_url, last_seen_at などを取得するため

-- last_seen_at が無い場合に追加（最終アクセス時刻用）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- フレンドのプロフィールを取得（RLS をバイパス、フレンド関係のみ返却）
DROP FUNCTION IF EXISTS public.get_profiles_for_friends(uuid[]);
CREATE OR REPLACE FUNCTION public.get_profiles_for_friends(p_friend_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  membership_tier text,
  last_seen_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    COALESCE(p.display_name, 'ユーザー'),
    p.avatar_url,
    COALESCE(p.membership_tier, 'free'),
    p.last_seen_at
  FROM profiles p
  WHERE p.user_id = ANY(p_friend_ids)
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = v_user_id AND f.friend_id = p.user_id)
          OR (f.friend_id = v_user_id AND f.user_id = p.user_id)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_for_friends(uuid[]) TO authenticated;
