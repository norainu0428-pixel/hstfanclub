-- 運営お知らせテーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 有効化
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーは閲覧可能
DROP POLICY IF EXISTS "Anyone can read announcements" ON announcements;
CREATE POLICY "Anyone can read announcements" ON announcements
  FOR SELECT USING (auth.role() = 'authenticated');

-- オーナーのみ作成・更新・削除可能（profiles.role = 'owner' を参照）
DROP POLICY IF EXISTS "Owner can insert announcements" ON announcements;
CREATE POLICY "Owner can insert announcements" ON announcements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS "Owner can update announcements" ON announcements;
CREATE POLICY "Owner can update announcements" ON announcements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

DROP POLICY IF EXISTS "Owner can delete announcements" ON announcements;
CREATE POLICY "Owner can delete announcements" ON announcements
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- 未認証でもお知らせを見れるようにする場合（任意）
-- 現状は認証ユーザーのみ SELECT 可能
