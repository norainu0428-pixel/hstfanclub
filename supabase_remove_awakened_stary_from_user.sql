-- 指定ユーザーから「覚醒STARY」をすべて削除する
-- Supabase SQL Editor で実行してください。

DELETE FROM user_members
WHERE user_id = '7d2ffd6b-79fc-409e-afa1-24e69d0e6a04'
  AND member_name = '覚醒STARY';
