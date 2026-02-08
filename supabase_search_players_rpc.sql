-- ========================================
-- プレイヤー検索用 RPC（RLS をバイパス）
-- Supabase SQL Editorで実行してください
-- ========================================
-- RLS ポリシーがうまく適用されない場合の代替手段です。
-- ログイン済みユーザーが他ユーザーを名前で検索できるようにします。
-- ========================================

-- 必要なカラムが無い場合は追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'membership_tier') THEN
    ALTER TABLE profiles ADD COLUMN membership_tier TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.search_players(search_term TEXT)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  membership_tier TEXT,
  avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    COALESCE(p.membership_tier, 'basic') AS membership_tier,
    p.avatar_url
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id != auth.uid()
    AND COALESCE(TRIM(p.display_name), '') != ''
    AND search_term IS NOT NULL
    AND TRIM(search_term) != ''
    AND (p.display_name IS NOT NULL AND p.display_name ILIKE '%' || TRIM(search_term) || '%')
  ORDER BY p.display_name NULLS LAST
  LIMIT 20;
$$;

-- RPC の実行権限（認証済みユーザー）
GRANT EXECUTE ON FUNCTION public.search_players(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_players(TEXT) TO anon;

SELECT '✅ search_players RPC が作成されました。プレイヤー検索が動作するようになります。' AS status;
