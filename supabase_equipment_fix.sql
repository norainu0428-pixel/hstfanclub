-- ========================================
-- 装備付与エラー修正用マイグレーション
-- エラー: "Could not find the 'definition_id' column of 'user_equipment'"
-- Supabase SQL Editorで実行してください
-- ========================================

-- 1. equipment_definitions が存在することを確認（supabase_equipment.sql を未実行の場合）
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

-- 装備マスタ初期データ（definition_id 追加時に参照するため先に挿入）
INSERT INTO equipment_definitions (name, icon, slot, rarity, hp_bonus, attack_bonus, defense_bonus, speed_bonus) VALUES
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

-- 2. user_equipment に definition_id が無い場合に追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_equipment' AND column_name = 'definition_id'
  ) THEN
    -- user_equipment テーブルが存在しない場合は作成
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_equipment') THEN
      CREATE TABLE user_equipment (
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
    ELSE
      -- テーブルは存在するが definition_id が無い → カラム追加
      ALTER TABLE user_equipment ADD COLUMN definition_id UUID REFERENCES equipment_definitions(id) ON DELETE CASCADE;
      UPDATE user_equipment ue
      SET definition_id = (SELECT id FROM equipment_definitions LIMIT 1)
      WHERE ue.definition_id IS NULL;
      ALTER TABLE user_equipment ALTER COLUMN definition_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- 3. member_equipment が無い場合は作成
CREATE TABLE IF NOT EXISTS member_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_member_id UUID NOT NULL REFERENCES user_members(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('weapon', 'armor', 'accessory')),
  user_equipment_id UUID NOT NULL REFERENCES user_equipment(id) ON DELETE CASCADE,
  UNIQUE(user_member_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_member_equipment_member ON member_equipment(user_member_id);
ALTER TABLE member_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own member_equipment" ON member_equipment;
CREATE POLICY "Users can manage own member_equipment" ON member_equipment
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_members um WHERE um.id = member_equipment.user_member_id AND um.user_id = auth.uid())
  );

-- 4. Supabaseのスキーマキャッシュを再読み込み（PostgREST）
NOTIFY pgrst, 'reload schema';

SELECT '✅ 装備テーブル修正完了！装備付与が動作するようになりました。' AS status;
