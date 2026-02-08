-- 進化システム（レベルMAXで進化可能）
-- Supabase SQL Editorで実行してください

ALTER TABLE user_members ADD COLUMN IF NOT EXISTS evolution_stage INTEGER DEFAULT 0;
ALTER TABLE user_members ADD COLUMN IF NOT EXISTS evolved_at TIMESTAMP;

COMMENT ON COLUMN user_members.evolution_stage IS '0=未進化, 1=進化済み';
COMMENT ON COLUMN user_members.evolved_at IS '進化した日時';
