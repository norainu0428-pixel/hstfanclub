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
-- ※Lv999(ATK~6600,HP~26000)級でも最終ステージは2人協力必須になるよう調整済み
INSERT INTO party_stages (stage_order, name, description, recommended_level, enemies, exp_reward, points_reward) VALUES
(1, '初心者の試練', '協力しないと倒せない！最初の壁', 1,
 '[{"name":"キングスライム","emoji":"🟢","hp":1200,"max_hp":1200,"attack":120,"defense":80,"speed":50,"experience_reward":80,"points_reward":50}]'::jsonb,
 80, 50),
(2, 'ゴブリンの巣窟', '大群＋ボス。ソロでは無理', 167,
 '[{"name":"ゴブリン戦士","emoji":"👺","hp":3500,"max_hp":3500,"attack":580,"defense":520,"speed":550,"experience_reward":200,"points_reward":100},{"name":"ゴブリン戦士","emoji":"👺","hp":3500,"max_hp":3500,"attack":580,"defense":520,"speed":550,"experience_reward":200,"points_reward":100},{"name":"ゴブリンキング","emoji":"👺","hp":9000,"max_hp":9000,"attack":850,"defense":750,"speed":720,"experience_reward":400,"points_reward":200}]'::jsonb,
 350, 200),
(3, 'オークの襲撃', '3体同時。2人で分担しろ', 334,
 '[{"name":"オーク将軍","emoji":"👹","hp":6500,"max_hp":6500,"attack":1100,"defense":1000,"speed":1100,"experience_reward":350,"points_reward":180},{"name":"オーク将軍","emoji":"👹","hp":6500,"max_hp":6500,"attack":1100,"defense":1000,"speed":1100,"experience_reward":350,"points_reward":180},{"name":"オークロード","emoji":"👹","hp":14000,"max_hp":14000,"attack":1400,"defense":1250,"speed":1300,"experience_reward":600,"points_reward":300}]'::jsonb,
 550, 300),
(4, 'ウルフパック', '全員高スピード。1人だと即全滅', 501,
 '[{"name":"アルファウルフ","emoji":"🐺","hp":9500,"max_hp":9500,"attack":1650,"defense":1550,"speed":1800,"experience_reward":450,"points_reward":230},{"name":"アルファウルフ","emoji":"🐺","hp":9500,"max_hp":9500,"attack":1650,"defense":1550,"speed":1800,"experience_reward":450,"points_reward":230},{"name":"アルファウルフ","emoji":"🐺","hp":9500,"max_hp":9500,"attack":1650,"defense":1550,"speed":1800,"experience_reward":450,"points_reward":230}]'::jsonb,
 650, 250),
(5, 'スケルトン軍団', '不死＋ボス。火力分断必須', 667,
 '[{"name":"スケルトンナイト","emoji":"💀","hp":12500,"max_hp":12500,"attack":2200,"defense":2100,"speed":2200,"experience_reward":550,"points_reward":280},{"name":"スケルトンナイト","emoji":"💀","hp":12500,"max_hp":12500,"attack":2200,"defense":2100,"speed":2200,"experience_reward":550,"points_reward":280},{"name":"スケルトンエンペラー","emoji":"💀👑","hp":30000,"max_hp":30000,"attack":2800,"defense":2600,"speed":2700,"experience_reward":1200,"points_reward":600}]'::jsonb,
 1100, 600),
(6, 'ダークマジシャン', '魔法攻撃＋2体。タンクと火力役で', 834,
 '[{"name":"アーカンマジシャン","emoji":"🔮","hp":19500,"max_hp":19500,"attack":3400,"defense":3200,"speed":3400,"experience_reward":700,"points_reward":350},{"name":"アーカンマジシャン","emoji":"🔮","hp":19500,"max_hp":19500,"attack":3400,"defense":3200,"speed":3400,"experience_reward":700,"points_reward":350}]'::jsonb,
 1300, 400),
(7, 'ドラゴンの巣', '双竜。1人では絶対無理', 1000,
 '[{"name":"エルダードラゴン","emoji":"🐉","hp":27000,"max_hp":27000,"attack":4500,"defense":4200,"speed":4500,"experience_reward":900,"points_reward":450},{"name":"エルダードラゴン","emoji":"🐉","hp":27000,"max_hp":27000,"attack":4500,"defense":4200,"speed":4500,"experience_reward":900,"points_reward":450}]'::jsonb,
 1500, 500),
(8, 'デーモン討伐', '地獄の三銃士。役割分担が命', 1167,
 '[{"name":"ヘルデーモン","emoji":"😈","hp":33000,"max_hp":33000,"attack":5200,"defense":4900,"speed":5200,"experience_reward":1100,"points_reward":550},{"name":"ヘルデーモン","emoji":"😈","hp":33000,"max_hp":33000,"attack":5200,"defense":4900,"speed":5200,"experience_reward":1100,"points_reward":550},{"name":"ヘルデーモン","emoji":"😈","hp":33000,"max_hp":33000,"attack":5200,"defense":4900,"speed":5200,"experience_reward":1100,"points_reward":550}]'::jsonb,
 1600, 600),
(9, 'アークデーモン', '最強の悪魔×2。完璧な連携で', 1334,
 '[{"name":"アークデーモン","emoji":"👿","hp":42000,"max_hp":42000,"attack":6200,"defense":5800,"speed":6200,"experience_reward":1400,"points_reward":700},{"name":"アークデーモン","emoji":"👿","hp":42000,"max_hp":42000,"attack":6200,"defense":5800,"speed":6200,"experience_reward":1400,"points_reward":700}]'::jsonb,
 1800, 750),
(10, 'パーティー・マスター', '伝説＋混沌。推奨Lv1500の頂点', 1500,
 '[{"name":"レジェンドドラゴン","emoji":"🐲","hp":55000,"max_hp":55000,"attack":7800,"defense":7200,"speed":7500,"experience_reward":3000,"points_reward":1500},{"name":"カオスロード","emoji":"🌑","hp":70000,"max_hp":70000,"attack":9500,"defense":8800,"speed":9000,"experience_reward":4000,"points_reward":2000}]'::jsonb,
 3500, 1800)
ON CONFLICT (stage_order) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  recommended_level = EXCLUDED.recommended_level,
  enemies = EXCLUDED.enemies,
  exp_reward = EXCLUDED.exp_reward,
  points_reward = EXCLUDED.points_reward;
