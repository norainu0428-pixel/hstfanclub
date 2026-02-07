-- ========================================
-- HSTファンクラブ セットアップSQL（完全版）
-- Supabase Dashboard → SQL Editor で実行してください
-- ========================================

-- ========================================
-- 1. profiles テーブル（未作成の場合）
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'staff', 'premium', 'member')),
  points INTEGER DEFAULT 0,
  membership_tier TEXT CHECK (membership_tier IN ('basic', 'premium')),
  premium_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新規ユーザー登録時にプロフィールを自動作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    'member'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile and owners can view all" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile and owners can view all" ON profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND LOWER(p.role) = 'owner'
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND LOWER(p.role) = 'owner'
    )
  );

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND LOWER(p.role) = 'owner'
    )
  );

-- ========================================
-- 2. 自分をオーナーに設定する（重要！）
-- ========================================
-- 以下の手順で実行してください：
-- 1. Supabase Dashboard → Authentication → Users で自分のユーザーを開く
-- 2. User UID をコピー
-- 3. 下の 'YOUR_USER_ID_HERE' をそのUUIDに置き換えて実行

-- UPDATE profiles SET role = 'owner' WHERE user_id = 'YOUR_USER_ID_HERE';

-- または、メールアドレスで指定する場合：
-- UPDATE profiles 
-- SET role = 'owner' 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'あなたのメール@example.com');

-- ========================================
-- 3. 既存ユーザーにプロフィールがなければ作成
-- ========================================
INSERT INTO profiles (user_id, display_name, role, points)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
  'member',
  100
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- 4. user_members テーブル（冒険ゲーム用）
-- ========================================
CREATE TABLE IF NOT EXISTS user_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_emoji TEXT NOT NULL,
  member_description TEXT,
  rarity TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  current_hp INTEGER,
  attack INTEGER DEFAULT 10,
  defense INTEGER DEFAULT 5,
  speed INTEGER DEFAULT 5,
  skill_type TEXT,
  skill_power INTEGER DEFAULT 0,
  revive_used BOOLEAN DEFAULT false,
  obtained_at TIMESTAMP DEFAULT NOW(),
  is_favorite BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT false
);

-- 既存テーブルにカラムがなければ追加
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS current_hp INTEGER;
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS skill_type TEXT;
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS skill_power INTEGER DEFAULT 0;
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS revive_used BOOLEAN DEFAULT false;
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;

-- current_hpをmax_hpで埋める
UPDATE user_members SET current_hp = COALESCE(max_hp, hp) WHERE current_hp IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_members_user_id ON user_members(user_id);

-- user_members RLS
ALTER TABLE user_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own members" ON user_members;
CREATE POLICY "Users can view own members" ON user_members FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own members" ON user_members;
CREATE POLICY "Users can insert own members" ON user_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own members" ON user_members;
CREATE POLICY "Users can update own members" ON user_members FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own members" ON user_members;
CREATE POLICY "Users can delete own members" ON user_members FOR DELETE USING (auth.uid() = user_id);

-- ========================================
-- 5. 通常会員ガチャ・プレミアムガチャ確率テーブル
-- ========================================
CREATE TABLE IF NOT EXISTS basic_gacha_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rarity TEXT NOT NULL UNIQUE,
  rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ten_pull_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO basic_gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.1, 0.5),
  ('legendary', 1.0, 5.0),
  ('ultra-rare', 3.0, 10.0),
  ('super-rare', 10.0, 20.0),
  ('rare', 30.0, 30.0),
  ('common', 55.9, 34.5),
  ('HST', 0, 0)
ON CONFLICT (rarity) DO NOTHING;

ALTER TABLE basic_gacha_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view basic gacha rates" ON basic_gacha_rates;
CREATE POLICY "Anyone can view basic gacha rates" ON basic_gacha_rates FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS gacha_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rarity TEXT NOT NULL UNIQUE,
  rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ten_pull_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO gacha_rates (rarity, rate, ten_pull_rate) VALUES
  ('stary', 0.5, 2.0),
  ('legendary', 2.0, 8.0),
  ('ultra-rare', 5.0, 15.0),
  ('super-rare', 15.0, 25.0),
  ('rare', 30.0, 30.0),
  ('common', 47.5, 20.0),
  ('HST', 0, 0)
ON CONFLICT (rarity) DO NOTHING;

ALTER TABLE gacha_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view gacha rates" ON gacha_rates;
CREATE POLICY "Anyone can view gacha rates" ON gacha_rates FOR SELECT USING (true);

-- ========================================
-- 6. user_progress, battle_logs, daily_missions 等
-- ========================================
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_stage INTEGER DEFAULT 1,
  total_battles INTEGER DEFAULT 0,
  total_victories INTEGER DEFAULT 0,
  total_defeats INTEGER DEFAULT 0,
  highest_damage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battle_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  party_members JSONB NOT NULL,
  enemy_type TEXT NOT NULL,
  result TEXT NOT NULL,
  turns_taken INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_received INTEGER DEFAULT 0,
  experience_gained INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  reward_points INTEGER DEFAULT 0,
  reward_exp INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_mission_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID REFERENCES daily_missions(id) ON DELETE CASCADE,
  current_count INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  mission_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, mission_id, mission_date)
);

-- 各テーブルのRLS・インデックス（省略されている場合は既存ファイルを参照）
-- 必要に応じて supabase_setup.sql, supabase_additional_setup.sql も実行してください

-- ========================================
-- 完了
-- ========================================
SELECT '✅ セットアップ完了！次に「2. 自分をオーナーに設定」のUPDATE文を実行してください。' AS status;
