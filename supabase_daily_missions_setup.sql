-- デイリーミッション機能用のSQL
-- Supabase SQL Editorで実行してください

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
  ('battle_win', 'バトルマスター', 'バトルに5回勝利する', 5, 50, 100, 'easy'),
  ('battle_complete', '戦士の道', 'バトルを10回完了する', 10, 100, 200, 'normal'),
  ('gacha_pull', 'ガチャ好き', 'ガチャを3回引く', 3, 150, 0, 'easy'),
  ('stage_clear', 'ステージクリア', 'ステージを3回クリアする', 3, 200, 300, 'normal'),
  ('level_up', '成長の証', 'メンバーを1回レベルアップさせる', 1, 100, 150, 'easy'),
  ('battle_win', '勝利の追求', 'バトルに10回勝利する', 10, 200, 400, 'hard'),
  ('gacha_pull', 'ガチャマニア', 'ガチャを10回引く', 10, 500, 0, 'hard'),
  ('stage_clear', '冒険者', 'ステージを10回クリアする', 10, 500, 1000, 'hard')
) AS v(mission_type, title, description, target_count, reward_points, reward_exp, difficulty)
WHERE NOT EXISTS (
  SELECT 1 FROM daily_missions 
  WHERE daily_missions.mission_type = v.mission_type 
    AND daily_missions.title = v.title
);
