-- ========================================
-- ミッション報酬ポイントを減らす
-- Supabase SQL Editorで実行してください
-- ========================================

UPDATE daily_missions SET reward_points = 25  WHERE title = 'バトルマスター';
UPDATE daily_missions SET reward_points = 50  WHERE title = '戦士の道';
UPDATE daily_missions SET reward_points = 50  WHERE title = 'ガチャ好き';
UPDATE daily_missions SET reward_points = 75  WHERE title = 'ステージクリア';
UPDATE daily_missions SET reward_points = 50  WHERE title = '成長の証';
UPDATE daily_missions SET reward_points = 100 WHERE title = '勝利の追求';
UPDATE daily_missions SET reward_points = 150 WHERE title = 'ガチャマニア';
UPDATE daily_missions SET reward_points = 150 WHERE title = '冒険者';

SELECT '✅ ミッション報酬ポイントを減らしました' AS status;
SELECT title, reward_points FROM daily_missions ORDER BY title;
