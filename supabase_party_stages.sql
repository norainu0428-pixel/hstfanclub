-- ========================================
-- パーティーモード用ステージ（冒険モードとは別）
-- ========================================
-- 実装内容:
-- ・パーティーモード専用のステージをDBで管理
-- ・冒険モード（1〜400ステージ）とは独立したステージ構成
-- ・各ステージに敵データ（JSONB）、推奨レベル、報酬を設定
-- Supabase SQL Editorで実行してください
-- ========================================

CREATE TABLE IF NOT EXISTS party_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_order INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  recommended_level INTEGER DEFAULT 1,
  enemies JSONB NOT NULL,
  exp_reward INTEGER DEFAULT 100,
  points_reward INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- enemies JSONB 形式: [{name, emoji, hp, max_hp, attack, defense, speed, experience_reward, points_reward}]

ALTER TABLE party_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active party_stages" ON party_stages;
CREATE POLICY "Anyone can read active party_stages" ON party_stages
  FOR SELECT USING (is_active = true);

-- オーナー・スタッフは管理可能
DROP POLICY IF EXISTS "Admins can manage party_stages" ON party_stages;
CREATE POLICY "Admins can manage party_stages" ON party_stages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('owner', 'staff'))
  );

-- 初期ステージデータ（10ステージ）
-- ※敵は「1人（3体）では倒せない」協力専用の強さ。フレンドと2人で挑戦する想定。
INSERT INTO party_stages (stage_order, name, description, recommended_level, enemies, exp_reward, points_reward) VALUES
(1, '初心者の試練', '協力しないと倒せない！最初の壁', 1,
 '[{"name":"キングスライム","emoji":"🟢","hp":800,"max_hp":800,"attack":65,"defense":35,"speed":22,"experience_reward":80,"points_reward":50}]'::jsonb,
 80, 50),
(2, 'ゴブリンの巣窟', '大群＋ボス。ソロでは無理', 3,
 '[{"name":"ゴブリン戦士","emoji":"👺","hp":450,"max_hp":450,"attack":55,"defense":28,"speed":25,"experience_reward":70,"points_reward":40},{"name":"ゴブリン戦士","emoji":"👺","hp":450,"max_hp":450,"attack":55,"defense":28,"speed":25,"experience_reward":70,"points_reward":40},{"name":"ゴブリンキング","emoji":"👺","hp":1200,"max_hp":1200,"attack":85,"defense":45,"speed":28,"experience_reward":150,"points_reward":80}]'::jsonb,
 150, 80),
(3, 'オークの襲撃', '3体同時。2人で分担しろ', 5,
 '[{"name":"オーク将軍","emoji":"👹","hp":700,"max_hp":700,"attack":75,"defense":42,"speed":26,"experience_reward":100,"points_reward":55},{"name":"オーク将軍","emoji":"👹","hp":700,"max_hp":700,"attack":75,"defense":42,"speed":26,"experience_reward":100,"points_reward":55},{"name":"オークロード","emoji":"👹","hp":1600,"max_hp":1600,"attack":100,"defense":55,"speed":30,"experience_reward":200,"points_reward":100}]'::jsonb,
 200, 100),
(4, 'ウルフパック', '全員高スピード。1人だと即全滅', 8,
 '[{"name":"アルファウルフ","emoji":"🐺","hp":550,"max_hp":550,"attack":90,"defense":35,"speed":38,"experience_reward":90,"points_reward":50},{"name":"アルファウルフ","emoji":"🐺","hp":550,"max_hp":550,"attack":90,"defense":35,"speed":38,"experience_reward":90,"points_reward":50},{"name":"アルファウルフ","emoji":"🐺","hp":550,"max_hp":550,"attack":90,"defense":35,"speed":38,"experience_reward":90,"points_reward":50}]'::jsonb,
 250, 90),
(5, 'スケルトン軍団', '不死＋ボス。火力分断必須', 10,
 '[{"name":"スケルトンナイト","emoji":"💀","hp":900,"max_hp":900,"attack":95,"defense":50,"speed":32,"experience_reward":120,"points_reward":60},{"name":"スケルトンナイト","emoji":"💀","hp":900,"max_hp":900,"attack":95,"defense":50,"speed":32,"experience_reward":120,"points_reward":60},{"name":"スケルトンエンペラー","emoji":"💀👑","hp":2500,"max_hp":2500,"attack":130,"defense":70,"speed":35,"experience_reward":350,"points_reward":180}]'::jsonb,
 350, 180),
(6, 'ダークマジシャン', '魔法攻撃＋2体。タンクと火力役で', 12,
 '[{"name":"アーカンマジシャン","emoji":"🔮","hp":1400,"max_hp":1400,"attack":120,"defense":55,"speed":40,"experience_reward":180,"points_reward":90},{"name":"アーカンマジシャン","emoji":"🔮","hp":1400,"max_hp":1400,"attack":120,"defense":55,"speed":40,"experience_reward":180,"points_reward":90}]'::jsonb,
 360, 120),
(7, 'ドラゴンの巣', '双竜。1人では絶対無理', 15,
 '[{"name":"エルダードラゴン","emoji":"🐉","hp":2200,"max_hp":2200,"attack":150,"defense":75,"speed":45,"experience_reward":300,"points_reward":150},{"name":"エルダードラゴン","emoji":"🐉","hp":2200,"max_hp":2200,"attack":150,"defense":75,"speed":45,"experience_reward":300,"points_reward":150}]'::jsonb,
 500, 200),
(8, 'デーモン討伐', '地獄の三銃士。役割分担が命', 18,
 '[{"name":"ヘルデーモン","emoji":"😈","hp":1800,"max_hp":1800,"attack":165,"defense":85,"speed":48,"experience_reward":350,"points_reward":180},{"name":"ヘルデーモン","emoji":"😈","hp":1800,"max_hp":1800,"attack":165,"defense":85,"speed":48,"experience_reward":350,"points_reward":180},{"name":"ヘルデーモン","emoji":"😈","hp":1800,"max_hp":1800,"attack":165,"defense":85,"speed":48,"experience_reward":350,"points_reward":180}]'::jsonb,
 500, 250),
(9, 'アークデーモン', '最強の悪魔×2。完璧な連携で', 22,
 '[{"name":"アークデーモン","emoji":"👿","hp":3200,"max_hp":3200,"attack":200,"defense":110,"speed":52,"experience_reward":500,"points_reward":280},{"name":"アークデーモン","emoji":"👿","hp":3200,"max_hp":3200,"attack":200,"defense":110,"speed":52,"experience_reward":500,"points_reward":280}]'::jsonb,
 600, 300),
(10, 'パーティー・マスター', '伝説＋混沌。2人で全力を', 25,
 '[{"name":"レジェンドドラゴン","emoji":"🐲","hp":4500,"max_hp":4500,"attack":240,"defense":130,"speed":58,"experience_reward":700,"points_reward":400},{"name":"カオスロード","emoji":"🌑","hp":5500,"max_hp":5500,"attack":270,"defense":145,"speed":62,"experience_reward":900,"points_reward":500}]'::jsonb,
 800, 450)
ON CONFLICT (stage_order) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  recommended_level = EXCLUDED.recommended_level,
  enemies = EXCLUDED.enemies,
  exp_reward = EXCLUDED.exp_reward,
  points_reward = EXCLUDED.points_reward;
