-- ========================================
-- smileキャラクターのスキル追加SQL
-- 既存のsmileキャラクターにattack_boostスキルを追加
-- ========================================

-- 1. 初期キャラクターとして作成されたsmile（skill_typeがnull）にスキルを追加
UPDATE user_members
SET 
  skill_type = 'attack_boost',
  skill_power = CASE 
    WHEN rarity = 'legendary' THEN 20
    WHEN rarity = 'ultra-rare' THEN 18
    WHEN rarity = 'super-rare' THEN 15
    WHEN rarity = 'rare' THEN 12
    WHEN rarity = 'common' THEN 10
    ELSE 15
  END
WHERE member_name = 'smile'
  AND (skill_type IS NULL OR skill_type = '');

-- 2. 確認用クエリ
SELECT 
  member_name,
  rarity,
  level,
  skill_type,
  skill_power,
  COUNT(*) AS count
FROM user_members
WHERE member_name = 'smile'
GROUP BY member_name, rarity, level, skill_type, skill_power
ORDER BY rarity, level DESC;

-- 3. 完了メッセージ
SELECT '✅ smileキャラクターのスキル追加完了' AS status;
