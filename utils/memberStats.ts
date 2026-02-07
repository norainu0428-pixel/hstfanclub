/**
 * 個体値・才能値（厳選要素）の計算ユーティリティ
 */

/** 個体値の範囲 -10〜+10 */
const IV_MIN = -10;
const IV_MAX = 10;

/** 才能値の範囲 0〜100 */
const TALENT_MIN = 0;
const TALENT_MAX = 100;

export interface IVStats {
  individual_hp: number;
  individual_atk: number;
  individual_def: number;
  individual_spd: number;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

/** ランダムな個体値を生成（-10〜+10） */
export function generateRandomIV(): IVStats {
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  return {
    individual_hp: rand(IV_MIN, IV_MAX),
    individual_atk: rand(IV_MIN, IV_MAX),
    individual_def: rand(IV_MIN, IV_MAX),
    individual_spd: rand(IV_MIN, IV_MAX)
  };
}

/** ランダムな才能値を生成（0〜100） */
export function generateRandomTalent(): number {
  return Math.floor(Math.random() * (TALENT_MAX - TALENT_MIN + 1)) + TALENT_MIN;
}

/** 個体値を適用した初期ステータスを計算 */
export function applyIVToStats(base: BaseStats, iv: IVStats): BaseStats {
  const apply = (val: number, ivVal: number) =>
    Math.max(1, Math.floor(val * (1 + ivVal / 100)));
  return {
    hp: apply(base.hp, iv.individual_hp),
    attack: apply(base.attack, iv.individual_atk),
    defense: apply(base.defense, iv.individual_def),
    speed: apply(base.speed, iv.individual_spd)
  };
}

/** 才能値による成長倍率（0.5〜1.5） */
export function getTalentGrowthMultiplier(talentValue: number): number {
  const clamped = Math.max(TALENT_MIN, Math.min(TALENT_MAX, talentValue ?? 50));
  return 0.5 + clamped / 100;
}

/** 個体値の評価（総合） */
export function getIVEvaluation(iv: IVStats): string {
  const total = iv.individual_hp + iv.individual_atk + iv.individual_def + iv.individual_spd;
  if (total >= 30) return '極上';
  if (total >= 20) return '素晴らしい';
  if (total >= 10) return '良い';
  if (total >= 0) return '普通';
  if (total >= -10) return 'やや低め';
  return '低め';
}

/** 才能値の評価 */
export function getTalentEvaluation(talent: number): string {
  if (talent >= 90) return '天才';
  if (talent >= 70) return '秀才';
  if (talent >= 50) return '普通';
  if (talent >= 30) return 'やや低め';
  return '低め';
}

/** ガチャ・初期付与用：個体値・才能値を生成し、適用したステータスを返す */
export function generateMemberStatsWithIV(base: BaseStats): {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  individual_hp: number;
  individual_atk: number;
  individual_def: number;
  individual_spd: number;
  talent_value: number;
} {
  const iv = generateRandomIV();
  const talent = generateRandomTalent();
  const applied = applyIVToStats(base, iv);
  return {
    ...applied,
    ...iv,
    talent_value: talent
  };
}
