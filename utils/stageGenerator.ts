import { Enemy } from '@/types/adventure';

// エクストラステージのID（ステージ100クリアで解放）
export const EXTRA_STAGE_ID = 999;

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

// ステージ情報を生成
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

// エクストラステージ生成（ステージ100クリアで挑戦可能、武器ドロップあり）
export function generateExtraStageInfo(): StageInfo {
  const recommendedLevel = 80;
  const baseStats = calculateEnemyStatsByLevel(recommendedLevel);
  const bossMultiplier = 1.8;
  const enemyPowerRatio = 1.8;

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
    const mult = isBoss ? bossMultiplier : 1.5;
    const skill = EXTRA_BOSS_SKILLS[i % EXTRA_BOSS_SKILLS.length];
    const hp = Math.floor(baseStats.hp * enemyPowerRatio * mult);
    const attack = Math.floor(baseStats.attack * enemyPowerRatio * mult * 2.5);
    const defense = Math.floor(baseStats.defense * enemyPowerRatio * mult * 2);
    const speed = Math.floor(baseStats.speed * enemyPowerRatio * mult);

    enemies.push({
      name: isBoss ? `${extraEnemyTypes[i].name}（極）` : extraEnemyTypes[i].name,
      emoji: extraEnemyTypes[i].emoji,
      hp,
      max_hp: hp,
      attack,
      defense,
      speed,
      experience_reward: Math.floor(500 * mult),
      points_reward: Math.floor(30 * mult),
      skill_type: skill.skill_type,
      skill_power: skill.skill_power,
    });
  }

  return {
    stage: EXTRA_STAGE_ID,
    recommendedLevel,
    enemies,
    isExtra: true,
  };
}

// 特定のステージ情報を取得
export function getStageInfo(stage: number): StageInfo {
  if (stage === EXTRA_STAGE_ID) {
    return generateExtraStageInfo();
  }
  return generateStageInfo(stage);
}
