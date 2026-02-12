import { Enemy } from '@/types/adventure';

// エクストラステージ（ステージ100クリアで401から挑戦可能、Lv1000まで楽しめる）
export const EXTRA_STAGE_START = 401;
export const EXTRA_STAGE_END = 1000;
export const isExtraStage = (stage: number) =>
  stage >= EXTRA_STAGE_START && stage <= EXTRA_STAGE_END;

// 覇者の塔（Tower of Conquerors）
// 2001〜2100 を「1〜100階」に対応させる
export const TOWER_STAGE_START = 2001;
export const TOWER_STAGE_END = 2100;
export const isTowerStage = (stage: number) =>
  stage >= TOWER_STAGE_START && stage <= TOWER_STAGE_END;

// HST Riemu イベントステージ
// 3001〜3006 をイベント用ステージとして扱う
export const RIEMU_EVENT_STAGES = [3001, 3002, 3003, 3004, 3005, 3006] as const;
export const isRiemuEventStage = (stage: number) =>
  RIEMU_EVENT_STAGES.includes(stage as (typeof RIEMU_EVENT_STAGES)[number]);

// レベルアップ専用ステージ
// 3101: 初級, 3102: 中級, 3103: 上級
export const LEVEL_TRAINING_STAGES = [3101, 3102, 3103] as const;
export const isLevelTrainingStage = (stage: number) =>
  LEVEL_TRAINING_STAGES.includes(stage as (typeof LEVEL_TRAINING_STAGES)[number]);

// ステージ情報
export interface StageInfo {
  stage: number;
  recommendedLevel: number;
  enemies: Enemy[];
  isExtra?: boolean;
}

// 敵の種類と絵文字（400ステージまで対応）
const ENEMY_TYPES = [
  { name: 'スライム', emoji: '🟢' },
  { name: 'ゴブリン', emoji: '👺' },
  { name: 'オーク', emoji: '👹' },
  { name: 'ウルフ', emoji: '🐺' },
  { name: 'スケルトン', emoji: '💀' },
  { name: 'オーク戦士', emoji: '⚔️' },
  { name: 'ダークマジシャン', emoji: '🔮' },
  { name: 'ドラゴン', emoji: '🐉' },
  { name: 'デーモン', emoji: '😈' },
  { name: 'アークデーモン', emoji: '👿' },
  { name: 'レジェンドドラゴン', emoji: '🐲' },
  { name: 'カオスロード', emoji: '🌑' },
  { name: 'アルティメットボス', emoji: '💀👑' },
  { name: 'エルダードラゴン', emoji: '🐉🔥' },
  { name: 'カオスデーモン', emoji: '😈⚡' },
  { name: 'アビスロード', emoji: '🌊' },
  { name: 'インフェルノキング', emoji: '🔥👑' },
  { name: 'ヴォイドウォーカー', emoji: '🌌' },
  { name: 'エターナルガーディアン', emoji: '🛡️✨' },
  { name: 'アルカナマスター', emoji: '🔮⭐' },
  { name: 'ワールドエンダー', emoji: '💥🌍' },
  { name: 'タイムブレイカー', emoji: '⏰💫' },
  { name: 'スペースドラゴン', emoji: '🌠🐉' },
  { name: 'コスミックホラー', emoji: '🌑👁️' },
  { name: 'オメガエンティティ', emoji: 'Ω' },
  { name: 'アルファプレデター', emoji: 'α' },
  { name: 'ネメシス', emoji: '⚖️' },
  { name: 'アポカリプス', emoji: '☄️' },
  { name: 'レクイエム', emoji: '🎭' },
  { name: 'ファイナルボス', emoji: '👑💀' },
];

// 推奨レベルに基づいて敵のステータスを計算
// commonレアリティのLv1を基準として、推奨レベルのステータスを計算
function calculateEnemyStatsByLevel(level: number): { hp: number, attack: number, defense: number, speed: number } {
  // commonレアリティのLv1基準値
  const baseStats = { hp: 60, attack: 10, defense: 8, speed: 10 };
  // commonレアリティのレベルアップ成長値
  const growthPerLevel = { hp: 6, attack: 1, defense: 1, speed: 1 };
  
  // レベルアップ回数
  const levelUps = level - 1;
  
  return {
    hp: baseStats.hp + levelUps * growthPerLevel.hp,
    attack: baseStats.attack + levelUps * growthPerLevel.attack,
    defense: baseStats.defense + levelUps * growthPerLevel.defense,
    speed: baseStats.speed + levelUps * growthPerLevel.speed
  };
}

// ステージ情報を生成（通常ステージ 1-400）
export function generateStageInfo(stage: number): StageInfo {
  // 推奨レベル: ステージ数に応じて段階的に上がる（400ステージまで対応）
  const recommendedLevel = Math.max(1, Math.floor(stage / 2) + 1);
  
  // 敵の数: ステージが高いほど多くなる（最大5体、高ステージでは固定）
  let enemyCount: number;
  if (stage <= 100) {
    enemyCount = Math.min(5, Math.max(1, Math.floor(stage / 20) + 1));
  } else if (stage <= 200) {
    enemyCount = Math.min(5, Math.max(3, Math.floor(stage / 30) + 2));
  } else if (stage <= 300) {
    enemyCount = Math.min(5, Math.max(4, Math.floor(stage / 50) + 3));
  } else {
    enemyCount = 5; // 300以降は常に5体
  }
  
  // ボスステージ（10の倍数）は特別に強く、100の倍数はさらに強く
  const isBossStage = stage % 10 === 0;
  const isMegaBossStage = stage % 100 === 0;
  const isUltimateBossStage = stage % 200 === 0;
  let bossMultiplier = 1;
  if (isUltimateBossStage) {
    bossMultiplier = 1.5; // 200の倍数は1.5倍
  } else if (isMegaBossStage) {
    bossMultiplier = 1.3; // 100の倍数は1.3倍
  } else if (isBossStage) {
    bossMultiplier = 1.2; // 10の倍数は1.2倍
  }
  
  // 推奨レベルに基づいて基本ステータスを計算
  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);
  
  const enemies: Enemy[] = [];
  // 初心者向けにステージ1だけ難易度をかなり下げる
  const difficultyAdjust = stage === 1 ? 0.5 : 1;
  
  for (let i = 0; i < enemyCount; i++) {
    // 敵の種類をステージに応じて選択（400ステージまで対応）
    let enemyTypeIndex: number;
    if (stage <= 100) {
      enemyTypeIndex = Math.min(Math.floor(stage / 10), ENEMY_TYPES.length - 1);
    } else if (stage <= 200) {
      enemyTypeIndex = Math.min(10 + Math.floor((stage - 100) / 10), ENEMY_TYPES.length - 1);
    } else if (stage <= 300) {
      enemyTypeIndex = Math.min(20 + Math.floor((stage - 200) / 10), ENEMY_TYPES.length - 1);
    } else {
      enemyTypeIndex = Math.min(30 + Math.floor((stage - 300) / 10), ENEMY_TYPES.length - 1);
    }
    enemyTypeIndex = Math.min(enemyTypeIndex, ENEMY_TYPES.length - 1);
    const enemyType = ENEMY_TYPES[enemyTypeIndex];
    
    // 最後の敵はボス（ボスステージの場合）
    const isBoss = isBossStage && i === enemyCount - 1;
    const multiplier = isBoss ? bossMultiplier : 1;
    
    // 推奨レベルに基づいてステータスを計算（敵はプレイヤーより明確に強く）
    // 通常敵は推奨レベルの140%、ボスは1.6倍×multiplier（かなり手強い）
    // 攻撃・防御は2倍で手応えある難易度に
    const baseEnemyPowerRatio = isBoss ? 1.6 * multiplier : 1.4;
    const enemyPowerRatio = baseEnemyPowerRatio * difficultyAdjust;
    
    const hp = Math.floor(baseStats.hp * enemyPowerRatio);
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * 2);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * 2);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio);
    
    // 経験値とポイント報酬（400ステージまで適切にスケール）
    // ポイント報酬は1勝利あたり10ポイント（全敵を倒した時の合計）
    // 敵1体あたりのポイントを計算（敵の数で割る）
    let expReward: number, pointsReward: number;
    const basePointsPerEnemy = 10 / enemyCount; // 1勝利で10ポイントになるように敵の数で割る
    
    if (stage <= 100) {
      expReward = Math.floor((20 + (stage - 1) * 5) * multiplier);
      pointsReward = Math.floor(basePointsPerEnemy * multiplier);
    } else if (stage <= 200) {
      const base100 = { exp: 20 + 99 * 5 };
      expReward = Math.floor((base100.exp + (stage - 100) * 8) * multiplier);
      pointsReward = Math.floor(basePointsPerEnemy * multiplier);
    } else if (stage <= 300) {
      const base200 = { exp: 20 + 99 * 5 + 100 * 8 };
      expReward = Math.floor((base200.exp + (stage - 200) * 12) * multiplier);
      pointsReward = Math.floor(basePointsPerEnemy * multiplier);
    } else {
      const base300 = { exp: 20 + 99 * 5 + 100 * 8 + 100 * 12 };
      expReward = Math.floor((base300.exp + (stage - 300) * 15) * multiplier);
      pointsReward = Math.floor(basePointsPerEnemy * multiplier);
    }
    
    // 敵の名前（ボスステージの場合は特別な名前）
    let enemyName: string;
    if (isUltimateBossStage && i === enemyCount - 1) {
      enemyName = `${enemyType.name}（アルティメットボス）`;
    } else if (isMegaBossStage && i === enemyCount - 1) {
      enemyName = `${enemyType.name}（メガボス）`;
    } else if (isBoss && i === enemyCount - 1) {
      enemyName = `${enemyType.name}（ボス）`;
    } else {
      enemyName = `${enemyType.name} Lv.${Math.floor(stage / 5) + 1}`;
    }
    
    enemies.push({
      name: enemyName,
      emoji: enemyType.emoji,
      hp: hp,
      max_hp: hp,
      attack: attack,
      defense: defense,
      speed: speed,
      experience_reward: expReward,
      points_reward: pointsReward
    });
  }
  
  return {
    stage,
    recommendedLevel,
    enemies
  };
}

// 全ステージ情報を取得（1-400）
export function getAllStages(): StageInfo[] {
  const stages: StageInfo[] = [];
  for (let i = 1; i <= 400; i++) {
    stages.push(generateStageInfo(i));
  }
  return stages;
}

// エクストラステージ用：最強クラスの攻撃系スキル（回復以外）
const EXTRA_BOSS_SKILLS = [
  { skill_type: 'critical_strike', skill_power: 200 }, // 必殺の一撃
  { skill_type: 'insta_kill', skill_power: 15 },       // 確率即死15%
  { skill_type: 'execute', skill_power: 250 },         // 弱点突き
  { skill_type: 'blade_storm', skill_power: 150 },     // ブレードストーム
  { skill_type: 'damage_reflect', skill_power: 50 },   // ダメージ反射
  { skill_type: 'thunder_strike', skill_power: 180 },  // 雷撃
  { skill_type: 'dark_strike', skill_power: 180 },     // 闇の裁き
];

// エクストラステージ生成（401-1000、推奨Lv80→1000でスケール、全員ボススキル・武器ドロップあり）
export function generateExtraStageInfo(stage: number): StageInfo {
  // 401→Lv80、1000→Lv1000 で線形
  const recommendedLevel = Math.min(1000, Math.floor(80 + ((stage - EXTRA_STAGE_START) * (1000 - 80)) / (EXTRA_STAGE_END - EXTRA_STAGE_START)));
  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);
  const bossMultiplier = 1.5 + (stage - EXTRA_STAGE_START) / (EXTRA_STAGE_END - EXTRA_STAGE_START) * 0.5; // 1.5〜2.0
  const enemyPowerRatio = 1.6 + (stage - EXTRA_STAGE_START) / (EXTRA_STAGE_END - EXTRA_STAGE_START) * 0.4; // 1.6〜2.0

  const enemies: Enemy[] = [];
  const extraEnemyTypes = [
    { name: 'カオスデーモン', emoji: '😈⚡' },
    { name: 'アビスロード', emoji: '🌊' },
    { name: 'インフェルノキング', emoji: '🔥👑' },
    { name: 'ヴォイドウォーカー', emoji: '🌌' },
    { name: 'エクストラボス', emoji: '💀👑' },
  ];

  for (let i = 0; i < 5; i++) {
    const isBoss = i === 4;
    const mult = isBoss ? bossMultiplier : 1.3;
    const skill = EXTRA_BOSS_SKILLS[i % EXTRA_BOSS_SKILLS.length];
    const hp = Math.floor(baseStats.hp * enemyPowerRatio * mult);
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * mult * 2.2);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * mult * 2);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio * mult);

    const expBase = 300 + (stage - EXTRA_STAGE_START) * 2;
    const pointsBase = 20 + Math.floor((stage - EXTRA_STAGE_START) / 30);

    enemies.push({
      name: isBoss ? `${extraEnemyTypes[i].name}（極）` : extraEnemyTypes[i].name,
      emoji: extraEnemyTypes[i].emoji,
      hp,
      max_hp: hp,
      attack,
      defense,
      speed,
      experience_reward: Math.floor(expBase * mult),
      points_reward: Math.floor(pointsBase * mult),
      skill_type: skill.skill_type,
      skill_power: skill.skill_power,
    });
  }

  return {
    stage,
    recommendedLevel,
    enemies,
    isExtra: true,
  };
}

// 覇者の塔ステージ生成（Tower of Conquerors）
// 2001〜2100 → 1〜100階。
// 1階は初心者でも勝てるようにかなり抑えめ（推奨Lv300前後）から始まり、100階で2500までスケール。
export function generateTowerStageInfo(stage: number): StageInfo {
  const floor = stage - TOWER_STAGE_START + 1; // 1〜100

  // 1階: Lv300 / 100階: Lv2500 になるように線形スケール
  const recommendedLevel = Math.min(
    2500,
    Math.floor(300 + ((floor - 1) * (2500 - 300)) / (TOWER_STAGE_END - TOWER_STAGE_START))
  );

  // 基本ステータス（commonレアの成長式に合わせる）
  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);

  const enemies: Enemy[] = [];

  // 覇者の塔用の敵タイプ（塔らしいボス感のある敵）
  const towerEnemyTypes = [
    { name: '塔の守護者', emoji: '🛡️' },
    { name: '深淵の騎士', emoji: '⚔️🌑' },
    { name: '煌黒竜', emoji: '🐉✨' },
    { name: '時空の支配者', emoji: '⏳👁️' },
    { name: '覇者の化身', emoji: '👑💀' },
  ];

  // 上層ほど敵数・強さともに増していく。常に2〜5体。
  const enemyCount = Math.min(5, 2 + Math.floor(floor / 30)); // 1〜30F:2体, 31〜60F:3体, 61〜90F:4体, 91F〜:5体

  for (let i = 0; i < enemyCount; i++) {
    const isBoss = i === enemyCount - 1;

    // 階層が上がるほど全体倍率も上がるが、序盤はかなり控えめに
    const floorRatio = 0.7 + (floor - 1) / 80; // 1F付近:0.7台 / 100F付近:約2.0前後
    const bossMultiplier = isBoss ? 1.6 * floorRatio : 1.2 * floorRatio;
    const enemyPowerRatio = isBoss ? 1.9 * floorRatio : 1.5 * floorRatio;

    const typeIndex = Math.min(
      towerEnemyTypes.length - 1,
      Math.floor((floor - 1) / 25) + (isBoss ? 1 : 0)
    );
    const enemyType = towerEnemyTypes[typeIndex];

    const hp = Math.floor(baseStats.hp * enemyPowerRatio * (isBoss ? 1.4 : 1.0));
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * 2.0);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * 1.6);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio * 1.1);

    // 経験値とポイントは、エクストラ終盤よりも明確に上
    const expBase = 400 + floor * 6;
    const pointsBase = 30 + Math.floor(floor / 3);

    const enemyName = isBoss
      ? `${enemyType.name} 第${floor}階の覇者`
      : `${enemyType.name} 第${floor}階兵`;

    enemies.push({
      name: enemyName,
      emoji: enemyType.emoji,
      hp,
      max_hp: hp,
      attack,
      defense,
      speed,
      experience_reward: Math.floor(expBase * bossMultiplier),
      points_reward: Math.floor(pointsBase * (isBoss ? 1.5 : 1.0)),
    });
  }

  return {
    stage,
    recommendedLevel,
    enemies,
  };
}

// 覇者の塔 各階クリア報酬
// ここでは追加ポイントのみを定義し、実際の付与はバトル勝利処理側で行う。
export function getTowerRewardByStage(stage: number): { floor: number; bonusPoints: number; label: string } | null {
  if (!isTowerStage(stage)) return null;
  const floor = stage - TOWER_STAGE_START + 1;

  // ベース: 1階100pt から始まり、階ごとに+20pt。10階ごとにボーナス倍率。
  let bonusPoints = 100 + (floor - 1) * 20; // 1F=100, 100F=100 + 99*20 = 2080
  const isMilestone10 = floor % 10 === 0;
  const isMilestone25 = floor % 25 === 0;
  const isTopFloor = floor === 100;

  if (isTopFloor) {
    bonusPoints *= 5; // 最上階は特別に5倍
  } else if (isMilestone25) {
    bonusPoints *= 3;
  } else if (isMilestone10) {
    bonusPoints *= 2;
  }

  const label = floor === 1
    ? '覇者の塔・初登頂ボーナス'
    : isTopFloor
    ? '覇者の塔・完全制覇ボーナス'
    : `覇者の塔 第${floor}階 クリアボーナス`;

  return { floor, bonusPoints: Math.floor(bonusPoints), label };
}

// HST Riemu イベントステージ生成
// 6ステージ構成で、それぞれクリア報酬のレアリティが異なる。
// ステージIDと推奨レベル・レアリティ対応:
// 3001: Lv1,   riemu, common
// 3002: Lv60,  riemu, rare
// 3003: Lv80,  riemu, super-rare
// 3004: Lv100, riemu, ultra-rare
// 3005: Lv120, riemu, legendary
// 3006: Lv500, HST riemu, HST
export function generateRiemuEventStageInfo(stage: number): StageInfo {
  const config: Record<number, { recommendedLevel: number }> = {
    3001: { recommendedLevel: 1 },
    3002: { recommendedLevel: 60 },
    3003: { recommendedLevel: 80 },
    3004: { recommendedLevel: 100 },
    3005: { recommendedLevel: 120 },
    3006: { recommendedLevel: 500 },
  };

  const entry = config[stage];
  const recommendedLevel = entry?.recommendedLevel ?? 1;

  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);

  const enemies: Enemy[] = [];

  // 難易度ごとに敵数を調整（序盤は1体、後半は最大3体）
  let enemyCount = 1;
  if (stage >= 3003 && stage <= 3004) enemyCount = 2;
  if (stage >= 3005) enemyCount = 3;

  for (let i = 0; i < enemyCount; i++) {
    const isBoss = i === enemyCount - 1;
    const floorIndex = stage - 3001; // 0〜5

    // ステージが上がるごとに倍率アップ
    const powerBase = 1.2 + floorIndex * 0.2; // 1.2〜2.2
    const enemyPowerRatio = isBoss ? powerBase * 1.8 : powerBase * 1.4;

    const hp = Math.floor(baseStats.hp * enemyPowerRatio * (isBoss ? 1.5 : 1.0));
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * 2.0);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * 1.8);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio * 1.1);

    const expReward = Math.floor(50 + recommendedLevel * (isBoss ? 2.5 : 1.5));
    const pointsReward = Math.floor(20 + recommendedLevel / 5) * (isBoss ? 2 : 1);

    const nameBase =
      stage === 3006
        ? 'HST riemu'
        : 'riemu';
    const enemyName = isBoss
      ? `${nameBase} イベントボス`
      : `${nameBase} の影`;

    enemies.push({
      name: enemyName,
      emoji: '🌟',
      hp,
      max_hp: hp,
      attack,
      defense,
      speed,
      experience_reward: expReward,
      points_reward: pointsReward,
    });
  }

  return {
    stage,
    recommendedLevel,
    enemies,
  };
}

// レベルアップ専用ステージ生成
// 3101: 初級（Lv1〜50向け）、3102: 中級（Lv1〜100向け）、3103: 上級（Lv200〜300向け）
export function generateLevelTrainingStageInfo(stage: number): StageInfo {
  const config: Record<number, { recommendedLevel: number; enemyCount: number }> = {
    3101: { recommendedLevel: 20, enemyCount: 3 },  // 初級
    3102: { recommendedLevel: 60, enemyCount: 4 },  // 中級
    3103: { recommendedLevel: 240, enemyCount: 5 }, // 上級
  };

  const entry = config[stage] ?? config[3101];
  const recommendedLevel = entry.recommendedLevel;
  const enemyCount = entry.enemyCount;

  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);

  const enemies: Enemy[] = [];

  for (let i = 0; i < enemyCount; i++) {
    const isBoss = i === enemyCount - 1;

    // 初級・中級は比較的やさしめ、上級はかなり高火力
    const stageIndex = stage === 3103 ? 2 : stage === 3102 ? 1 : 0;
    const basePower = [1.0, 1.4, 1.8][stageIndex]; // 初級1.0, 中級1.4, 上級1.8
    const enemyPowerRatio = isBoss ? basePower * 1.4 : basePower * 1.1;

    const hp = Math.floor(baseStats.hp * enemyPowerRatio);
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * 2.0);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * 1.6);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio);

    // レベルアップ用なので経験値をかなり多めに（上級で合計 ~40万EXP）
    // 初級: 合計 ~2万, 中級: 合計 ~10万, 上級: 合計 ~40万 になるように調整
    const expRewardBase =
      stage === 3103 ? 70000 : // 上級: 5体 * (4体+ボス1.8倍) ≒ 5.8 * 70000 ≒ 406,000
      stage === 3102 ? 21000 : // 中級: 4体 * (3体+ボス1.8倍) ≒ 4.8 * 21000 ≒ 100,800
      5500;                    // 初級: 3体 * (2体+ボス1.8倍) ≒ 3.8 * 5500 ≒ 20,900
    const expReward = Math.floor(expRewardBase * (isBoss ? 1.8 : 1.0));
    const pointsReward = 1; // ここではポイント目的ではないので固定で少量

    const nameBase = stage === 3103 ? 'レベル上げ上級' : stage === 3102 ? 'レベル上げ中級' : 'レベル上げ初級';
    const enemyName = isBoss ? `${nameBase} ボス` : `${nameBase} 敵`;

    enemies.push({
      name: enemyName,
      emoji: isBoss ? '💪' : '⚔️',
      hp,
      max_hp: hp,
      attack,
      defense,
      speed,
      experience_reward: expReward,
      points_reward: pointsReward,
    });
  }

  return {
    stage,
    recommendedLevel,
    enemies,
  };
}

// 特定のステージ情報を取得
export function getStageInfo(stage: number): StageInfo {
  if (isLevelTrainingStage(stage)) {
    return generateLevelTrainingStageInfo(stage);
  }
  if (isRiemuEventStage(stage)) {
    return generateRiemuEventStageInfo(stage);
  }
  if (isTowerStage(stage)) {
    return generateTowerStageInfo(stage);
  }
  if (isExtraStage(stage)) {
    return generateExtraStageInfo(stage);
  }
  return generateStageInfo(stage);
}
