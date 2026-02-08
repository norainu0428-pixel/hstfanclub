-- ========================================
-- 装備システム
-- ========================================
-- 実装内容:
-- ・装備マスタ（武器・防具・アクセサリ、レアリティ別ステータス）
-- ・ユーザー所持装備（装備ガチャ1000ptで入手）
-- ・メンバーへの装備装着（1メンバーあたり武器・防具・アクセサリの3スロット）
-- ・装備合成は同じ種類3つでLvアップ（最大Lv5）
-- ・バトル時に装備ボーナスがHP/ATK/DEF/SPDに加算される
-- Supabase SQL Editorで実行してください
-- ========================================

-- 装備マスタ（種類・レアリティ・ステータス）
CREATE TABLE IF NOT EXISTS equipment_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('weapon', 'armor', 'accessory')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'super-rare', 'ultra-rare', 'legendary')),
  hp_bonus INTEGER DEFAULT 0,
  attack_bonus INTEGER DEFAULT 0,
  defense_bonus INTEGER DEFAULT 0,
  speed_bonus INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, slot)
);

ALTER TABLE equipment_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read equipment_definitions" ON equipment_definitions;
CREATE POLICY "Anyone can read equipment_definitions" ON equipment_definitions FOR SELECT USING (true);

-- ユーザーが所持する装備（ガチャで入手）
CREATE TABLE IF NOT EXISTS user_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES equipment_definitions(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON user_equipment(user_id);
ALTER TABLE user_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own user_equipment" ON user_equipment;
CREATE POLICY "Users can manage own user_equipment" ON user_equipment
  FOR ALL USING (auth.uid() = user_id);

-- メンバーに装備している装備（user_member_id, slot -> user_equipment_id）
CREATE TABLE IF NOT EXISTS member_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_member_id UUID NOT NULL REFERENCES user_members(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('weapon', 'armor', 'accessory')),
  user_equipment_id UUID NOT NULL REFERENCES user_equipment(id) ON DELETE CASCADE,
  UNIQUE(user_member_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_member_equipment_member ON member_equipment(user_member_id);
ALTER TABLE member_equipment ENABLE ROW LEVEL SECURITY;

-- 自分のメンバーに紐づく装備のみ操作可能
DROP POLICY IF EXISTS "Users can manage own member_equipment" ON member_equipment;
CREATE POLICY "Users can manage own member_equipment" ON member_equipment
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_members um WHERE um.id = member_equipment.user_member_id AND um.user_id = auth.uid())
  );

-- 装備マスタの初期データ
INSERT INTO equipment_definitions (name, icon, slot, rarity, hp_bonus, attack_bonus, defense_bonus, speed_bonus) VALUES
-- weapon
('木の剣', '🗡️', 'weapon', 'common', 0, 3, 0, 0),
('鉄の剣', '⚔️', 'weapon', 'rare', 0, 8, 0, 0),
('炎の剣', '🔥', 'weapon', 'super-rare', 0, 15, 0, 2),
('雷の槍', '⚡', 'weapon', 'ultra-rare', 0, 22, 0, 5),
('伝説の剣', '👑', 'weapon', 'legendary', 10, 35, 5, 8),
('竹やり', '🎋', 'weapon', 'common', 0, 2, 0, 1),
('鋼の斧', '🪓', 'weapon', 'rare', 0, 10, 0, 0),
('氷の杖', '❄️', 'weapon', 'super-rare', 5, 12, 2, 0),
('光の剣', '✨', 'weapon', 'ultra-rare', 0, 25, 3, 6),
('HSTブレード', '😊', 'weapon', 'legendary', 20, 40, 10, 10),
-- armor
('布の服', '👕', 'armor', 'common', 5, 0, 2, 0),
('革の鎧', '🦺', 'armor', 'rare', 15, 0, 8, 0),
('鉄の鎧', '🛡️', 'armor', 'super-rare', 25, 0, 15, 0),
('魔法のローブ', '🧙', 'armor', 'ultra-rare', 40, 5, 18, 3),
('伝説の鎧', '🌟', 'armor', 'legendary', 60, 10, 25, 5),
('皮の防具', '🧶', 'armor', 'common', 8, 0, 3, 0),
('鎖かたびら', '⛓️', 'armor', 'rare', 20, 0, 10, 0),
('炎防の鎧', '🔥', 'armor', 'super-rare', 30, 0, 16, 0),
('聖なる鎧', '✨', 'armor', 'ultra-rare', 50, 0, 22, 4),
('HSTアーマー', '😊', 'armor', 'legendary', 80, 15, 35, 8),
-- accessory
('革のブレス', '📿', 'accessory', 'common', 3, 1, 1, 1),
('銀の指輪', '💍', 'accessory', 'rare', 8, 3, 3, 3),
('魔力のペンダント', '📿', 'accessory', 'super-rare', 15, 5, 5, 5),
('竜の瞳', '👁️', 'accessory', 'ultra-rare', 25, 8, 8, 10),
('伝説の指輪', '💎', 'accessory', 'legendary', 40, 12, 12, 15),
('木の腕輪', '⭕', 'accessory', 'common', 2, 0, 2, 0),
('金のブローチ', '📌', 'accessory', 'rare', 10, 4, 4, 2),
('星のピアス', '⭐', 'accessory', 'super-rare', 18, 6, 6, 6),
('時空の首飾り', '🌀', 'accessory', 'ultra-rare', 30, 10, 10, 12),
('HSTバッジ', '😊', 'accessory', 'legendary', 50, 15, 15, 20)
ON CONFLICT (name, slot) DO NOTHING;
