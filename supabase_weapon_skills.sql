-- 武器スキル（Lv5で解放）
-- Supabase SQL Editorで実行してください
--
-- ※ 先に supabase_equipment_setup.sql を実行して equipment_master テーブルを作成してください。
--    未実行の場合は「relation "equipment_master" does not exist」エラーになります。

-- equipment_master に武器スキル用カラムを追加
ALTER TABLE equipment_master
  ADD COLUMN IF NOT EXISTS weapon_skill_type TEXT,
  ADD COLUMN IF NOT EXISTS weapon_skill_power INTEGER DEFAULT 0;

-- 武器スキルを設定（武器のみ、Lv5で解放）
-- skill_type: 'attack_boost', 'defense_boost', 'heal', 'hst_power' など
UPDATE equipment_master SET weapon_skill_type = 'attack_boost', weapon_skill_power = 10
  WHERE name = '木の剣' AND slot_type = 'weapon';
UPDATE equipment_master SET weapon_skill_type = 'attack_boost', weapon_skill_power = 18
  WHERE name = '鉄の剣' AND slot_type = 'weapon';
UPDATE equipment_master SET weapon_skill_type = 'attack_boost', weapon_skill_power = 25
  WHERE name = '銀の剣' AND slot_type = 'weapon';
UPDATE equipment_master SET weapon_skill_type = 'hst_power', weapon_skill_power = 80
  WHERE name = '炎の剣' AND slot_type = 'weapon';
UPDATE equipment_master SET weapon_skill_type = 'hst_power', weapon_skill_power = 150
  WHERE name = '伝説の剣' AND slot_type = 'weapon';
