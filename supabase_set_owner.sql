-- ========================================
-- 自分をオーナーに設定するSQL
-- Supabase SQL Editorで実行
-- ========================================

-- 方法1: ユーザーIDを指定（推奨）
-- 1. Supabase Dashboard → Authentication → Users で自分のUser UIDをコピー
-- 2. 下の 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' を貼り付けて実行

UPDATE profiles 
SET role = 'owner' 
WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- 方法2: メールアドレスで指定
-- あなたのDiscord連携メールに置き換えて実行

-- UPDATE profiles 
-- SET role = 'owner' 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'あなたのメール@example.com'
-- );

-- 確認: オーナーになれたか確認
SELECT user_id, display_name, role, points 
FROM profiles 
WHERE role = 'owner';
