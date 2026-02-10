-- ========================================
-- member_equipment の RLS で INSERT を明示的に許可
-- 装備が装着されない場合は Supabase SQL Editor で実行してください
-- ========================================

DROP POLICY IF EXISTS "Users can manage own member_equipment" ON member_equipment;
CREATE POLICY "Users can manage own member_equipment" ON member_equipment
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_members um WHERE um.id = member_equipment.user_member_id AND um.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_members um WHERE um.id = member_equipment.user_member_id AND um.user_id = auth.uid())
  );

SELECT '✅ member_equipment RLS を更新しました（INSERT に WITH CHECK を追加）' AS status;
