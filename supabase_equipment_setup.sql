-- 装備システム
-- Supabase SQL Editorで実行してください

-- 装備マスター（種類定義）
CREATE TABLE IF NOT EXISTS equipment_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  slot_type TEXT NOT NULL, -- 'weapon', 'armor', 'accessory'
  rarity TEXT NOT NULL,   -- 'common', 'rare', 'super-rare', 'ultra-rare', 'legendary'
  base_atk INTEGER DEFAULT 0,
  base_def INTEGER DEFAULT 0,
  base_hp INTEGER DEFAULT 0,
  base_spd INTEGER DEFAULT 0,
  per_level_atk INTEGER DEFAULT 0,
  per_level_def INTEGER DEFAULT 0,
  per_level_hp INTEGER DEFAULT 0,
  per_level_spd INTEGER DEFAULT 0,
  max_level INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, slot_type, rarity)
);

-- ユーザー所持装備
CREATE TABLE IF NOT EXISTS user_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment_master(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  equipped_member_id UUID REFERENCES user_members(id) ON DELETE SET NULL,
  obtained_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON user_equipment(user_id);
CREATE INDEX IF NOT EXISTS idx_user_equipment_equipped ON user_equipment(equipped_member_id);

-- RLS
ALTER TABLE equipment_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view equipment master" ON equipment_master;
CREATE POLICY "Anyone can view equipment master" ON equipment_master
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own equipment" ON user_equipment;
CREATE POLICY "Users can view own equipment" ON user_equipment
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own equipment" ON user_equipment;
CREATE POLICY "Users can insert own equipment" ON user_equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own equipment" ON user_equipment;
CREATE POLICY "Users can update own equipment" ON user_equipment
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own equipment" ON user_equipment;
CREATE POLICY "Users can delete own equipment" ON user_equipment
  FOR DELETE USING (auth.uid() = user_id);

-- 装備マスターデータ（武器・防具・アクセサリ各レアリティ）
INSERT INTO equipment_master (name, emoji, slot_type, rarity, base_atk, base_def, base_hp, base_spd, per_level_atk, per_level_def, per_level_hp, per_level_spd) VALUES
-- 武器 weapon
('木の剣', '🗡️', 'weapon', 'common', 3, 0, 0, 0, 1, 0, 0, 0),
('鉄の剣', '⚔️', 'weapon', 'rare', 8, 0, 0, 0, 2, 0, 0, 0),
('銀の剣', '🔪', 'weapon', 'super-rare', 15, 0, 0, 0, 3, 0, 0, 0),
('炎の剣', '🔥', 'weapon', 'ultra-rare', 25, 0, 0, 0, 4, 0, 0, 0),
('伝説の剣', '👑', 'weapon', 'legendary', 40, 0, 0, 0, 5, 0, 0, 0),
-- 防具 armor
('布の服', '👕', 'armor', 'common', 0, 2, 15, 0, 0, 1, 5, 0),
('革の鎧', '🛡️', 'armor', 'rare', 0, 6, 40, 0, 0, 2, 10, 0),
('鎖かたびら', '⛓️', 'armor', 'super-rare', 0, 12, 70, 0, 0, 3, 15, 0),
('竜の鱗', '🐉', 'armor', 'ultra-rare', 0, 20, 120, 0, 0, 4, 25, 0),
('神の鎧', '✨', 'armor', 'legendary', 0, 30, 200, 0, 0, 5, 40, 0),
-- アクセサリ accessory
('革のブレス', '📿', 'accessory', 'common', 0, 0, 0, 3, 0, 0, 0, 1),
('銀の指輪', '💍', 'accessory', 'rare', 0, 0, 0, 8, 0, 0, 0, 2),
('魔法のペンダント', '📿', 'accessory', 'super-rare', 2, 2, 20, 12, 0, 0, 5, 2),
('龍の首飾り', '🐲', 'accessory', 'ultra-rare', 5, 5, 40, 18, 1, 1, 8, 2),
('創造の証', '⭐', 'accessory', 'legendary', 10, 10, 80, 25, 2, 2, 15, 3)
ON CONFLICT (name, slot_type, rarity) DO NOTHING;
