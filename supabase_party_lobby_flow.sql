-- ========================================
-- パーティーロビーのフロー変更
-- 3体選択→ロビーに入る→ロビーからフレンド招待
-- Supabase SQL Editorで実行してください
-- ========================================

-- 1. 既存のパーティ招待を全削除
DELETE FROM adventure_invites WHERE invite_mode = 'party';

-- 2. friend_id を NULL 許容に（ロビー単体で存在可能）
ALTER TABLE adventure_invites ALTER COLUMN friend_id DROP NOT NULL;

-- 3. status に 'lobby' を追加（ホストがロビーにいるだけの状態）
-- PostgreSQL の CHECK 制約を変更するには一度削除して再作成
ALTER TABLE adventure_invites DROP CONSTRAINT IF EXISTS adventure_invites_status_check;
ALTER TABLE adventure_invites ADD CONSTRAINT adventure_invites_status_check
  CHECK (status IN ('pending', 'accepted', 'cancelled', 'lobby'));

-- 4. バトル開始時のステージID（フレンドを一緒にバトルへ遷移させるため）
ALTER TABLE adventure_invites ADD COLUMN IF NOT EXISTS battle_party_stage_id UUID REFERENCES party_stages(id);

-- 5. UNIQUE(host_id, friend_id) は (host_id, NULL) を1件のみ許容（PostgreSQL では NULL 同士は別扱い）
COMMENT ON TABLE adventure_invites IS '協力バトル用。status=lobby はホストのみロビー。friend_id 設定後は招待として扱う';
