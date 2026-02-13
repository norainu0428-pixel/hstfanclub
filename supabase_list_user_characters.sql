-- 指定ユーザーが所持しているキャラクター一覧を表示する
-- Supabase SQL Editor で実行してください。

SELECT
  member_emoji,
  member_name,
  rarity,
  level,
  hp,
  max_hp,
  attack,
  defense,
  speed,
  skill_type,
  skill_power
FROM user_members
WHERE user_id = '7d2ffd6b-79fc-409e-afa1-24e69d0e6a04'
ORDER BY
  CASE rarity
    WHEN '覚醒' THEN 1
    WHEN 'HST' THEN 2
    WHEN 'stary' THEN 3
    WHEN 'legendary' THEN 4
    WHEN 'ultra-rare' THEN 5
    WHEN 'super-rare' THEN 6
    WHEN 'rare' THEN 7
    WHEN 'common' THEN 8
    ELSE 9
  END,
  level DESC,
  member_name;
