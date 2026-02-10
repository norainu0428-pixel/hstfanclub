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
    const enemyPowerRatio = isBoss ? 1.6 * multiplier : 1.4;
    
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
// 2001〜2100 → 1〜100階。推奨レベルは 1階でおおよそ1000付近から始まり、100階で2500までスケール。
export function generateTowerStageInfo(stage: number): StageInfo {
  const floor = stage - TOWER_STAGE_START + 1; // 1〜100

  // 既存エクストラステージの終盤（Lv1000付近）からさらに積み上げていくイメージでスケール
  // 1階: 約1000 / 100階: 2500
  const recommendedLevel = Math.min(
    2500,
    Math.floor(1000 + ((floor - 1) * (2500 - 1000)) / (TOWER_STAGE_END - TOWER_STAGE_START))
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

  // 上層ほど敵数・強さともに増していく。常に3〜5体。
  const enemyCount = Math.min(5, 3 + Math.floor(floor / 25)); // 1〜25F:3体, 26〜50F:4体, 51F〜:5体

  for (let i = 0; i < enemyCount; i++) {
    const isBoss = i === enemyCount - 1;

    // 階層が上がるほど全体倍率も上がる
    const floorRatio = 1 + (floor - 1) / 60; // 1F付近:1.0台 / 100F付近:2.6前後
    const bossMultiplier = isBoss ? 2.0 * floorRatio : 1.4 * floorRatio;
    const enemyPowerRatio = isBoss ? 2.2 * floorRatio : 1.7 * floorRatio;

    const typeIndex = Math.min(
      towerEnemyTypes.length - 1,
      Math.floor((floor - 1) / 25) + (isBoss ? 1 : 0)
    );
    const enemyType = towerEnemyTypes[typeIndex];

    const hp = Math.floor(baseStats.hp * enemyPowerRatio * (isBoss ? 1.5 : 1.0));
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * 2.3);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * 2.0);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio * 1.2);

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

// 特定のステージ情報を取得
export function getStageInfo(stage: number): StageInfo {
  if (isTowerStage(stage)) {
    return generateTowerStageInfo(stage);
  }
  if (isExtraStage(stage)) {
    return generateExtraStageInfo(stage);
  }
  return generateStageInfo(stage);
}
