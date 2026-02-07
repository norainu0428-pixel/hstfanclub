-- PvP対戦にスキル用カラムを追加（通常バトルと同じスキルを使用）
-- Supabase SQL Editor で実行してください

-- スキルクールダウン（メンバーID -> 残りターン数）
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player1_skill_cooldown JSONB DEFAULT '{}';
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player2_skill_cooldown JSONB DEFAULT '{}';

-- 自己蘇生使用済み（メンバーIDの配列）
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player1_revive_used JSONB DEFAULT '[]';
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player2_revive_used JSONB DEFAULT '[]';

-- 攻撃/防御ブフ（メンバーID -> { "attack": 数値, "defense": 数値 }）
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player1_buffs JSONB DEFAULT '{}';
ALTER TABLE pvp_battles ADD COLUMN IF NOT EXISTS player2_buffs JSONB DEFAULT '{}';
