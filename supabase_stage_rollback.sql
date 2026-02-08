-- ========================================
-- ステージ解放ルール変更に伴うデータ修正
-- 「クリアしていない次のステージは解放しない」に合わせ、
-- current_stage を「最後にクリアしたステージの次」に戻す
-- Supabase SQL Editorで1回だけ実行してください
-- ========================================

-- 各ユーザーの current_stage を「1から連続でクリア済みの最大+1」に更新
-- （1〜Nがすべてクリア済みなら N+1、どこかで欠けたらその最初の欠け＝次の挑戦ステージ）
UPDATE user_progress up
SET current_stage = LEAST(400, COALESCE(
  (
    SELECT MIN(s)
    FROM generate_series(1, 400) AS s
    WHERE NOT EXISTS (
      SELECT 1
      FROM battle_logs bl
      WHERE bl.user_id = up.user_id
        AND bl.result = 'victory'
        AND bl.stage = s
    )
  ), 401)
);

-- current_stage が 0 以下になる場合は 1 にしておく（念のため）
UPDATE user_progress
SET current_stage = 1
WHERE current_stage < 1;
