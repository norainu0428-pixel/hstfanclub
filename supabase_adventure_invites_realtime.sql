-- ========================================
-- adventure_invites を Realtime で購読可能に
-- パーティーロビーでフレンド参加をリアルタイム表示するために必要
-- Supabase SQL Editorで実行（初回のみ、既に追加済みの場合はエラーになる）
-- ========================================

ALTER PUBLICATION supabase_realtime ADD TABLE adventure_invites;
