-- ========================================
-- 通常会員ガチャ・ミッション・フレンド機能用SQL
-- Supabase SQL Editorで実行してください
-- ========================================

-- ========================================
-- 1. 通常会員ガチャ確率テーブル
-- ========================================

CREATE TABLE IF NOT EXISTS basic_gacha_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rarity TEXT NOT NULL UNIQUE,
  rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 単発ガチャ確率（%）
  ten_pull_rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 10連ガチャ確率（%）
  updated_at TIMESTAMP DEFAULT NOW()
);

-- デフォルト確率を設定
INSERT INTO basic_gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.1, 0.5),
  ('legendary', 1.0, 5.0),
  ('ultra-rare', 3.0, 10.0),
  ('super-rare', 10.0, 20.0),
  ('rare', 30.0, 30.0),
  ('common', 55.9, 34.5),
  ('HST', 0, 0) -- HSTは確率0%
ON CONFLICT (rarity) DO NOTHING;

-- RLS設定
ALTER TABLE basic_gacha_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view basic gacha rates" ON basic_gacha_rates;
CREATE POLICY "Anyone can view basic gacha rates" ON basic_gacha_rates
  FOR SELECT USING (true);

-- オーナー・スタッフのみ更新可能
DROP POLICY IF EXISTS "Admins can update basic gacha rates" ON basic_gacha_rates;
CREATE POLICY "Admins can update basic gacha rates" ON basic_gacha_rates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('owner', 'staff')
    )
  );

-- ========================================
-- 2. プレミアムガチャ確率テーブル（念のため）
-- ========================================

CREATE TABLE IF NOT EXISTS gacha_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rarity TEXT NOT NULL UNIQUE,
  rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 単発ガチャ確率（%）
  ten_pull_rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- 10連ガチャ確率（%）
  updated_at TIMESTAMP DEFAULT NOW()
);

-- デフォルト確率を設定
INSERT INTO gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.5, 2.0),
  ('legendary', 2.0, 8.0),
  ('ultra-rare', 5.0, 15.0),
  ('super-rare', 15.0, 25.0),
  ('rare', 30.0, 30.0),
  ('common', 47.5, 20.0),
  ('HST', 0, 0) -- HSTは確率0%
ON CONFLICT (rarity) DO NOTHING;

-- RLS設定
ALTER TABLE gacha_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view gacha rates" ON gacha_rates;
CREATE POLICY "Anyone can view gacha rates" ON gacha_rates
  FOR SELECT USING (true);

-- オーナー・スタッフのみ更新可能
DROP POLICY IF EXISTS "Admins can update gacha rates" ON gacha_rates;
CREATE POLICY "Admins can update gacha rates" ON gacha_rates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('owner', 'staff')
    )
  );

-- ========================================
-- 3. フレンド機能テーブル
-- ========================================

-- フレンド申請テーブル
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id) -- 自分自身には申請できない
);

-- フレンド関係テーブル
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'accepted', -- 'accepted', 'blocked'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id) -- 自分自身とはフレンドになれない
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- friend_requests RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friend requests" ON friend_requests;
CREATE POLICY "Users can view own friend requests" ON friend_requests
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
CREATE POLICY "Users can create friend requests" ON friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own received requests" ON friend_requests;
CREATE POLICY "Users can update own received requests" ON friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete own friend requests" ON friend_requests;
CREATE POLICY "Users can delete own friend requests" ON friend_requests
  FOR DELETE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- friendships RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- ========================================
-- 4. ミッション機能（既にsupabase_setup.sqlにある場合はスキップ）
-- ========================================

-- daily_missionsテーブル（デイリーミッション定義）
CREATE TABLE IF NOT EXISTS daily_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_type TEXT NOT NULL, -- 'battle_win', 'battle_complete', 'gacha_pull', 'stage_clear', 'level_up'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  reward_points INTEGER DEFAULT 0,
  reward_exp INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'normal', -- 'easy', 'normal', 'hard'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- user_mission_progressテーブル（ユーザーのミッション進捗）
CREATE TABLE IF NOT EXISTS user_mission_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES daily_missions(id) ON DELETE CASCADE,
  current_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  mission_date DATE NOT NULL, -- ミッションの日付（リセット用）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, mission_id, mission_date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_user_id ON user_mission_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_mission_date ON user_mission_progress(mission_date);
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_user_date ON user_mission_progress(user_id, mission_date);

-- daily_missions RLS（全員が閲覧可能）
ALTER TABLE daily_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active missions" ON daily_missions;
CREATE POLICY "Anyone can view active missions" ON daily_missions
  FOR SELECT USING (is_active = true);

-- user_mission_progress RLS
ALTER TABLE user_mission_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own mission progress" ON user_mission_progress;
CREATE POLICY "Users can view own mission progress" ON user_mission_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mission progress" ON user_mission_progress;
CREATE POLICY "Users can insert own mission progress" ON user_mission_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mission progress" ON user_mission_progress;
CREATE POLICY "Users can update own mission progress" ON user_mission_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- デフォルトミッションを挿入（既に存在する場合はスキップ）
INSERT INTO daily_missions (mission_type, title, description, target_count, reward_points, reward_exp, difficulty)
SELECT * FROM (VALUES
  ('battle_win', 'バトルマスター', 'バトルに5回勝利する', 5, 25, 100, 'easy'),
  ('battle_complete', '戦士の道', 'バトルを10回完了する', 10, 50, 200, 'normal'),
  ('gacha_pull', 'ガチャ好き', 'ガチャを3回引く', 3, 50, 0, 'easy'),
  ('stage_clear', 'ステージクリア', 'ステージを3回クリアする', 3, 75, 300, 'normal'),
  ('level_up', '成長の証', 'メンバーを1回レベルアップさせる', 1, 50, 150, 'easy'),
  ('battle_win', '勝利の追求', 'バトルに10回勝利する', 10, 100, 400, 'hard'),
  ('gacha_pull', 'ガチャマニア', 'ガチャを10回引く', 10, 150, 0, 'hard'),
  ('stage_clear', '冒険者', 'ステージを10回クリアする', 10, 150, 1000, 'hard')
) AS v(mission_type, title, description, target_count, reward_points, reward_exp, difficulty)
WHERE NOT EXISTS (
  SELECT 1 FROM daily_missions 
  WHERE daily_missions.mission_type = v.mission_type 
    AND daily_missions.title = v.title
);

-- ========================================
-- 完了メッセージ
-- ========================================

SELECT '✅ 通常会員ガチャ・ミッション・フレンド機能のテーブルが作成されました！' AS status;
