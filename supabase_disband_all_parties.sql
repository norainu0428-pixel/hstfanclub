-- ========================================
-- 全パーティー（チーム）を解散する
-- Supabase SQL Editorで実行してください
-- ========================================
-- 対象: adventure_invites の invite_mode='party' かつ
--       status が lobby / accepted / pending のもの
-- 実行後: 全て status='cancelled' になり、
--         ロビー・バトル中のユーザーは Realtime で検知して
--         /party?lobby_disbanded=1 にリダイレクトされます
-- ========================================

UPDATE adventure_invites
SET status = 'cancelled',
    updated_at = NOW()
WHERE invite_mode = 'party'
  AND status != 'cancelled';

SELECT '✅ 全パーティーを解散しました' AS status;
