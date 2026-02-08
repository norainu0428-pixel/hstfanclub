-- ========================================
-- フレンドと一緒にバトル・パーティを組む機能
-- Supabase SQL Editorで実行してください
-- ========================================

-- 1. 冒険招待テーブル（フレンドを誘って協力バトル）
CREATE TABLE IF NOT EXISTS adventure_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  host_party_ids TEXT[] NOT NULL DEFAULT '{}',
  friend_party_ids TEXT[] DEFAULT '{}',
  friend_party_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(host_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_adventure_invites_host ON adventure_invites(host_id);
CREATE INDEX IF NOT EXISTS idx_adventure_invites_friend ON adventure_invites(friend_id);
CREATE INDEX IF NOT EXISTS idx_adventure_invites_status ON adventure_invites(status);

-- RLS
ALTER TABLE adventure_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host or friend can view invite" ON adventure_invites;
CREATE POLICY "Host or friend can view invite" ON adventure_invites
  FOR SELECT USING (
    auth.uid() = host_id OR auth.uid() = friend_id
  );

DROP POLICY IF EXISTS "Host can create and update own invites" ON adventure_invites;
CREATE POLICY "Host can create and update own invites" ON adventure_invites
  FOR ALL USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Friend can update to accept" ON adventure_invites;
CREATE POLICY "Friend can update to accept" ON adventure_invites
  FOR UPDATE USING (auth.uid() = friend_id)
  WITH CHECK (auth.uid() = friend_id);

-- Friend can only insert when they are the friend (no - host creates). So no INSERT for friend.
-- Friend needs to UPDATE the row to set friend_party_ids, friend_party_snapshot, status.
-- So we need a policy that allows friend to update. Done above.

COMMENT ON TABLE adventure_invites IS 'フレンドを誘って協力冒険する招待';
COMMENT ON COLUMN adventure_invites.friend_party_snapshot IS 'フレンドが参加時に送るメンバースナップショット（協力バトル用）';

-- 2. フレンドの user_members を読めるようにする（パーティに1体借りる・協力バトル用）
-- 既存の "Users can view own members" に加え、フレンドのメンバーも SELECT 可能にする
DROP POLICY IF EXISTS "Users can view friends members" ON user_members;
CREATE POLICY "Users can view friends members" ON user_members
  FOR SELECT USING (
    user_id IN (
      SELECT friend_id FROM friendships WHERE user_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT user_id FROM friendships WHERE friend_id = auth.uid() AND status = 'accepted'
    )
  );
