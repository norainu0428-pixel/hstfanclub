-- ========================================
-- HST Smile表示問題の診断用SQL
-- Supabase SQL Editorで実行してください
-- ========================================

-- 1. 現在のユーザーID
SELECT '【現在のユーザー】' AS info, auth.uid() AS user_id;

-- 2. HSTメンバーの配布先
SELECT '【HSTメンバーの配布先】' AS info, 
  um.user_id,
  p.display_name,
  p.email,
  p.role,
  um.member_name,
  um.level,
  um.hp,
  um.rarity
FROM user_members um
LEFT JOIN profiles p ON um.user_id = p.user_id
WHERE um.rarity = 'HST'
ORDER BY um.user_id;

-- 3. 現在のユーザーの全メンバー（HST含む）
SELECT '【現在のユーザーの全メンバー】' AS info,
  member_name,
  rarity,
  level,
  hp,
  attack,
  defense,
  speed
FROM user_members
WHERE user_id = auth.uid()
ORDER BY 
  CASE rarity 
    WHEN 'HST' THEN 1
    WHEN 'stary' THEN 2
    WHEN 'legendary' THEN 3
    WHEN 'ultra-rare' THEN 4
    WHEN 'super-rare' THEN 5
    WHEN 'rare' THEN 6
    WHEN 'common' THEN 7
    ELSE 8
  END,
  level DESC;

-- 4. 現在のユーザーのプロフィール（role確認）
SELECT '【現在のユーザーのプロフィール】' AS info,
  user_id,
  display_name,
  email,
  role,
  membership_tier
FROM profiles
WHERE user_id = auth.uid();

-- 5. RLSポリシー確認
SELECT '【RLSポリシー】' AS info,
  policyname,
  cmd,
  LEFT(qual::text, 100) AS qual_preview
FROM pg_policies 
WHERE tablename = 'user_members'
ORDER BY policyname;

-- 6. RLSが有効か
SELECT '【RLS状態】' AS info,
  relname AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'user_members';

-- 7. 現在のユーザーがHSTを持っているか
SELECT '【HST所持確認】' AS info,
  COUNT(*) AS hst_count,
  STRING_AGG(member_name, ', ') AS hst_members
FROM user_members
WHERE user_id = auth.uid()
  AND rarity = 'HST';
