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
INSERT INTO party_stages (stage_order, name, description, recommended_level, enemies, exp_reward, points_reward) VALUES
(1, '初心者の試練', 'パーティー最初の挑戦', 1,
 '[{"name":"スライム Lv.1","emoji":"🟢","hp":30,"max_hp":30,"attack":8,"defense":5,"speed":8,"experience_reward":20,"points_reward":10}]'::jsonb,
 30, 25),
(2, 'ゴブリンの巣窟', '小さなゴブリンたち', 3,
 '[{"name":"ゴブリン Lv.2","emoji":"👺","hp":45,"max_hp":45,"attack":12,"defense":7,"speed":10,"experience_reward":35,"points_reward":15},{"name":"ゴブリン Lv.2","emoji":"👺","hp":45,"max_hp":45,"attack":12,"defense":7,"speed":10,"experience_reward":35,"points_reward":15}]'::jsonb,
 50, 40),
(3, 'オークの襲撃', '強力なオーク登場', 5,
 '[{"name":"オーク Lv.4","emoji":"👹","hp":80,"max_hp":80,"attack":18,"defense":12,"speed":9,"experience_reward":50,"points_reward":25},{"name":"オーク Lv.4","emoji":"👹","hp":80,"max_hp":80,"attack":18,"defense":12,"speed":9,"experience_reward":50,"points_reward":25},{"name":"オーク長 Lv.5","emoji":"👹","hp":100,"max_hp":100,"attack":22,"defense":15,"speed":10,"experience_reward":70,"points_reward":35}]'::jsonb,
 80, 60),
(4, 'ウルフパック', '狼の群れに注意', 8,
 '[{"name":"ウルフ Lv.6","emoji":"🐺","hp":70,"max_hp":70,"attack":20,"defense":8,"speed":15,"experience_reward":45,"points_reward":20},{"name":"ウルフ Lv.6","emoji":"🐺","hp":70,"max_hp":70,"attack":20,"defense":8,"speed":15,"experience_reward":45,"points_reward":20},{"name":"ウルフ Lv.6","emoji":"🐺","hp":70,"max_hp":70,"attack":20,"defense":8,"speed":15,"experience_reward":45,"points_reward":20}]'::jsonb,
 100, 75),
(5, 'スケルトン軍団', '不死の兵士たち', 10,
 '[{"name":"スケルトン Lv.8","emoji":"💀","hp":90,"max_hp":90,"attack":25,"defense":15,"speed":12,"experience_reward":60,"points_reward":30},{"name":"スケルトン Lv.8","emoji":"💀","hp":90,"max_hp":90,"attack":25,"defense":15,"speed":12,"experience_reward":60,"points_reward":30},{"name":"スケルトンキング Lv.10","emoji":"💀👑","hp":150,"max_hp":150,"attack":35,"defense":25,"speed":10,"experience_reward":120,"points_reward":60}]'::jsonb,
 150, 100),
(6, 'ダークマジシャン', '魔法使いの試練', 12,
 '[{"name":"ダークマジシャン Lv.11","emoji":"🔮","hp":120,"max_hp":120,"attack":40,"defense":18,"speed":14,"experience_reward":80,"points_reward":40},{"name":"ダークマジシャン Lv.11","emoji":"🔮","hp":120,"max_hp":120,"attack":40,"defense":18,"speed":14,"experience_reward":80,"points_reward":40}]'::jsonb,
 180, 120),
(7, 'ドラゴンの巣', '伝説のドラゴン', 15,
 '[{"name":"ドラゴン Lv.14","emoji":"🐉","hp":200,"max_hp":200,"attack":50,"defense":30,"speed":18,"experience_reward":150,"points_reward":80},{"name":"ドラゴン Lv.14","emoji":"🐉","hp":200,"max_hp":200,"attack":50,"defense":30,"speed":18,"experience_reward":150,"points_reward":80}]'::jsonb,
 250, 150),
(8, 'デーモン討伐', '地獄の使者', 18,
 '[{"name":"デーモン Lv.17","emoji":"😈","hp":250,"max_hp":250,"attack":60,"defense":35,"speed":20,"experience_reward":200,"points_reward":100},{"name":"デーモン Lv.17","emoji":"😈","hp":250,"max_hp":250,"attack":60,"defense":35,"speed":20,"experience_reward":200,"points_reward":100},{"name":"デーモン Lv.17","emoji":"😈","hp":250,"max_hp":250,"attack":60,"defense":35,"speed":20,"experience_reward":200,"points_reward":100}]'::jsonb,
 300, 180),
(9, 'アークデーモン', '最強の悪魔', 22,
 '[{"name":"アークデーモン Lv.21","emoji":"👿","hp":350,"max_hp":350,"attack":75,"defense":45,"speed":22,"experience_reward":300,"points_reward":150},{"name":"アークデーモン Lv.21","emoji":"👿","hp":350,"max_hp":350,"attack":75,"defense":45,"speed":22,"experience_reward":300,"points_reward":150}]'::jsonb,
 400, 220),
(10, 'パーティー・マスター', 'パーティーモード最終試練', 25,
 '[{"name":"レジェンドドラゴン Lv.24","emoji":"🐲","hp":400,"max_hp":400,"attack":85,"defense":50,"speed":25,"experience_reward":400,"points_reward":200},{"name":"カオスロード Lv.25","emoji":"🌑","hp":500,"max_hp":500,"attack":95,"defense":55,"speed":28,"experience_reward":500,"points_reward":250}]'::jsonb,
 500, 300)
ON CONFLICT (stage_order) DO NOTHING;
