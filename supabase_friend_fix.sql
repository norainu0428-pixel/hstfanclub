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
-- （既存の「自分 or オーナー」と OR されるため、ログイン済みなら全プロフィールの表示名を検索可能）
DROP POLICY IF EXISTS "Authenticated can read names for friend search" ON profiles;
CREATE POLICY "Authenticated can read names for friend search" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
