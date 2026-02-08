-- ========================================
-- パーティーモード用招待（adventure_invites を拡張）
-- invite_mode で冒険とパーティを区別
-- Supabase SQL Editorで実行してください
-- ========================================

-- invite_mode 追加（既存は 'adventure' 扱い）
ALTER TABLE adventure_invites ADD COLUMN IF NOT EXISTS invite_mode TEXT DEFAULT 'adventure' CHECK (invite_mode IN ('adventure', 'party'));

COMMENT ON COLUMN adventure_invites.invite_mode IS 'adventure=冒険モード, party=パーティーモード';
