-- 個体値・才能値（厳選要素）
-- Supabase SQL Editorで実行してください

-- user_members に個体値・才能値カラムを追加
-- 個体値: -10〜+10（基準0）、初期ステータスに (1 + 個体値/100) を乗算
-- 才能値: 0〜100（基準50）、レベルアップ時の成長に (0.5 + 才能値/100) を乗算
ALTER TABLE user_members
  ADD COLUMN IF NOT EXISTS individual_hp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS individual_atk INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS individual_def INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS individual_spd INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS talent_value INTEGER DEFAULT 50;

-- 既存メンバーは個体値0・才能値50（基準）のまま
