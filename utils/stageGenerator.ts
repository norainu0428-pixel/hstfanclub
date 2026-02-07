import { Enemy, EnemySkillType } from '@/types/adventure';

// ステージ情報
export interface StageInfo {
  stage: number;
  recommendedLevel: number;
  enemies: Enemy[];
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
  
  // 敵ステータス: ステージ1は易しく、それ以外は推奨レベル+15相当（厳しい難易度）
  const enemyLevel = stage === 1 ? 1 : recommendedLevel + 15;
  const baseStats = calculateEnemyStatsByLevel(enemyLevel);
  
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
    
    // ステージ1は易しく、それ以外は厳しい難易度
    const isStage1 = stage === 1;
    const hpRatio = isStage1 ? (isBoss ? 0.6 : 0.5) : (isBoss ? 1.1 * multiplier : 1.0);
    const defenseRatio = isStage1 ? (isBoss ? 0.5 : 0.45) : (isBoss ? 1.2 * multiplier : 1.1);
    const attackRatio = isStage1 ? (isBoss ? 0.7 : 0.6) : (isBoss ? 1.8 * multiplier : 1.7);
    const speedRatio = isStage1 ? (isBoss ? 0.7 : 0.6) : (isBoss ? 1.2 * multiplier : 1.1);
    
    const hp = Math.floor(baseStats.hp * hpRatio);
    const attack = Math.floor(baseStats.attack * attackRatio);
    const defense = Math.floor(baseStats.defense * defenseRatio);
    const speed = Math.floor(baseStats.speed * speedRatio);
    
    // 経験値とポイント報酬（400ステージまで適切にスケール）
    // ポイント報酬：ステージ1-30は10pt、31-60は20pt、61-90は30pt... 30ステージごとに+10pt
    let expReward: number, pointsReward: number;
    const basePointsPerStage = 10 + Math.floor((stage - 1) / 30) * 10;
    const basePointsPerEnemy = basePointsPerStage / enemyCount; // 敵の数で割って1体あたりに
    
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
    
    // ステージ60+のボスは強力なスキルを持つ
    let skill_type: EnemySkillType = null;
    let skill_power = 0;
    if (stage >= 60 && isBoss) {
      const bossSkills: { type: EnemySkillType; power: number }[] = [
        { type: 'heal', power: Math.floor(hp * 0.3) },           // 自分or味方のHP30%回復
        { type: 'revive', power: Math.floor(hp * 0.5) },          // 倒れた味方を50%HPで蘇生
        { type: 'attack_boost', power: Math.floor(attack * 0.5) } // 攻撃力50%上昇
      ];
      const skillIndex = stage % bossSkills.length;
      skill_type = bossSkills[skillIndex].type;
      skill_power = bossSkills[skillIndex].power;
    }
    
    enemies.push({
      id: `enemy_${stage}_${i}`,
      name: enemyName,
      emoji: enemyType.emoji,
      hp: hp,
      max_hp: hp,
      attack: attack,
      defense: defense,
      speed: speed,
      experience_reward: expReward,
      points_reward: pointsReward,
      ...(skill_type && { skill_type, skill_power })
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

// エクストラステージ定数（ステージ100クリアで解放）
export const EXTRA_STAGE_BASE = 1000; // 1001=Extra1, 1002=Extra2...
export const EXTRA_STAGE_COUNT = 10;

// エクストラステージ情報を生成（強力なボス1体、推奨レベル65〜110）
function generateExtraStageInfo(extraStageNum: number): StageInfo {
  const stage = EXTRA_STAGE_BASE + extraStageNum;
  const recommendedLevel = 60 + extraStageNum * 5; // Extra1=65, Extra10=110
  const enemyLevel = recommendedLevel + 15;
  const baseStats = calculateEnemyStatsByLevel(enemyLevel);
  
  // 強力なボス1体（最強の敵タイプを使用）
  const enemyType = ENEMY_TYPES[Math.min(9 + extraStageNum, ENEMY_TYPES.length - 1)];
  const bossMultiplier = 1.2 + (extraStageNum - 1) * 0.05; // Extra1=1.2, Extra10=1.65
  
  const hp = Math.floor(baseStats.hp * 1.2 * bossMultiplier);
  const attack = Math.floor(baseStats.attack * 1.8 * bossMultiplier);
  const defense = Math.floor(baseStats.defense * 1.2 * bossMultiplier);
  const speed = Math.floor(baseStats.speed * 1.2 * bossMultiplier);
  
  const expReward = Math.floor((500 + extraStageNum * 200) * bossMultiplier);
  const pointsReward = Math.floor((20 + extraStageNum * 5) * bossMultiplier);
  
  const bossSkills: { type: EnemySkillType; power: number }[] = [
    { type: 'heal', power: Math.floor(hp * 0.3) },
    { type: 'revive', power: Math.floor(hp * 0.5) },
    { type: 'attack_boost', power: Math.floor(attack * 0.5) }
  ];
  const skillIndex = extraStageNum % bossSkills.length;
  const { type: skill_type, power: skill_power } = bossSkills[skillIndex];
  
  const enemy: Enemy = {
    id: `enemy_extra_${extraStageNum}`,
    name: `${enemyType.name}（エクストラボス）`,
    emoji: enemyType.emoji,
    hp,
    max_hp: hp,
    attack,
    defense,
    speed,
    experience_reward: expReward,
    points_reward: pointsReward,
    skill_type,
    skill_power
  };
  
  return { stage, recommendedLevel, enemies: [enemy] };
}

// ステージIDがエクストラかどうか
export function isExtraStage(stage: number): boolean {
  return stage >= EXTRA_STAGE_BASE + 1 && stage <= EXTRA_STAGE_BASE + EXTRA_STAGE_COUNT;
}

// エクストラステージ番号を取得（1〜10）
export function getExtraStageNum(stage: number): number {
  return stage - EXTRA_STAGE_BASE;
}

// 特定のステージ情報を取得
export function getStageInfo(stage: number): StageInfo {
  if (isExtraStage(stage)) {
    return generateExtraStageInfo(getExtraStageNum(stage));
  }
  return generateStageInfo(stage);
}
