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
-- ※推奨レベルは 1 ～ 1500（一番上で1500）。敵は協力専用の強さ。
INSERT INTO party_stages (stage_order, name, description, recommended_level, enemies, exp_reward, points_reward) VALUES
(1, '初心者の試練', '協力しないと倒せない！最初の壁', 1,
 '[{"name":"キングスライム","emoji":"🟢","hp":800,"max_hp":800,"attack":65,"defense":35,"speed":22,"experience_reward":80,"points_reward":50}]'::jsonb,
 80, 50),
(2, 'ゴブリンの巣窟', '大群＋ボス。ソロでは無理', 167,
 '[{"name":"ゴブリン戦士","emoji":"👺","hp":1480,"max_hp":1480,"attack":246,"defense":244,"speed":246,"experience_reward":200,"points_reward":100},{"name":"ゴブリン戦士","emoji":"👺","hp":1480,"max_hp":1480,"attack":246,"defense":244,"speed":246,"experience_reward":200,"points_reward":100},{"name":"ゴブリンキング","emoji":"👺","hp":3500,"max_hp":3500,"attack":320,"defense":280,"speed":260,"experience_reward":400,"points_reward":200}]'::jsonb,
 350, 200),
(3, 'オークの襲撃', '3体同時。2人で分担しろ', 334,
 '[{"name":"オーク将軍","emoji":"👹","hp":2880,"max_hp":2880,"attack":480,"defense":477,"speed":480,"experience_reward":350,"points_reward":180},{"name":"オーク将軍","emoji":"👹","hp":2880,"max_hp":2880,"attack":480,"defense":477,"speed":480,"experience_reward":350,"points_reward":180},{"name":"オークロード","emoji":"👹","hp":5500,"max_hp":5500,"attack":580,"defense":520,"speed":500,"experience_reward":600,"points_reward":300}]'::jsonb,
 550, 300),
(4, 'ウルフパック', '全員高スピード。1人だと即全滅', 501,
 '[{"name":"アルファウルフ","emoji":"🐺","hp":4280,"max_hp":4280,"attack":714,"defense":711,"speed":720,"experience_reward":450,"points_reward":230},{"name":"アルファウルフ","emoji":"🐺","hp":4280,"max_hp":4280,"attack":714,"defense":711,"speed":720,"experience_reward":450,"points_reward":230},{"name":"アルファウルフ","emoji":"🐺","hp":4280,"max_hp":4280,"attack":714,"defense":711,"speed":720,"experience_reward":450,"points_reward":230}]'::jsonb,
 650, 250),
(5, 'スケルトン軍団', '不死＋ボス。火力分断必須', 667,
 '[{"name":"スケルトンナイト","emoji":"💀","hp":5680,"max_hp":5680,"attack":947,"defense":944,"speed":947,"experience_reward":550,"points_reward":280},{"name":"スケルトンナイト","emoji":"💀","hp":5680,"max_hp":5680,"attack":947,"defense":944,"speed":947,"experience_reward":550,"points_reward":280},{"name":"スケルトンエンペラー","emoji":"💀👑","hp":12000,"max_hp":12000,"attack":1100,"defense":1000,"speed":980,"experience_reward":1200,"points_reward":600}]'::jsonb,
 1100, 600),
(6, 'ダークマジシャン', '魔法攻撃＋2体。タンクと火力役で', 834,
 '[{"name":"アーカンマジシャン","emoji":"🔮","hp":7080,"max_hp":7080,"attack":1180,"defense":1177,"speed":1180,"experience_reward":700,"points_reward":350},{"name":"アーカンマジシャン","emoji":"🔮","hp":7080,"max_hp":7080,"attack":1180,"defense":1177,"speed":1180,"experience_reward":700,"points_reward":350}]'::jsonb,
 1300, 400),
(7, 'ドラゴンの巣', '双竜。1人では絶対無理', 1000,
 '[{"name":"エルダードラゴン","emoji":"🐉","hp":8480,"max_hp":8480,"attack":1413,"defense":1410,"speed":1413,"experience_reward":900,"points_reward":450},{"name":"エルダードラゴン","emoji":"🐉","hp":8480,"max_hp":8480,"attack":1413,"defense":1410,"speed":1413,"experience_reward":900,"points_reward":450}]'::jsonb,
 1500, 500),
(8, 'デーモン討伐', '地獄の三銃士。役割分担が命', 1167,
 '[{"name":"ヘルデーモン","emoji":"😈","hp":9880,"max_hp":9880,"attack":1646,"defense":1644,"speed":1646,"experience_reward":1100,"points_reward":550},{"name":"ヘルデーモン","emoji":"😈","hp":9880,"max_hp":9880,"attack":1646,"defense":1644,"speed":1646,"experience_reward":1100,"points_reward":550},{"name":"ヘルデーモン","emoji":"😈","hp":9880,"max_hp":9880,"attack":1646,"defense":1644,"speed":1646,"experience_reward":1100,"points_reward":550}]'::jsonb,
 1600, 600),
(9, 'アークデーモン', '最強の悪魔×2。完璧な連携で', 1334,
 '[{"name":"アークデーモン","emoji":"👿","hp":11280,"max_hp":11280,"attack":1880,"defense":1877,"speed":1880,"experience_reward":1400,"points_reward":700},{"name":"アークデーモン","emoji":"👿","hp":11280,"max_hp":11280,"attack":1880,"defense":1877,"speed":1880,"experience_reward":1400,"points_reward":700}]'::jsonb,
 1800, 750),
(10, 'パーティー・マスター', '伝説＋混沌。推奨Lv1500の頂点', 1500,
 '[{"name":"レジェンドドラゴン","emoji":"🐲","hp":12700,"max_hp":12700,"attack":2113,"defense":2110,"speed":2113,"experience_reward":2000,"points_reward":1000},{"name":"カオスロード","emoji":"🌑","hp":15500,"max_hp":15500,"attack":2500,"defense":2300,"speed":2350,"experience_reward":2500,"points_reward":1250}]'::jsonb,
 2200, 1100)
ON CONFLICT (stage_order) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  recommended_level = EXCLUDED.recommended_level,
  enemies = EXCLUDED.enemies,
  exp_reward = EXCLUDED.exp_reward,
  points_reward = EXCLUDED.points_reward;
