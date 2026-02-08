import { Member, MAX_LEVELS } from '@/types/adventure';

/** 進化時のステータス倍率 */
export const EVOLUTION_STAT_MULTIPLIER = 1.3;

/** 進化可能か（レベルMAXかつ未進化） */
export function canEvolve(member: Member): boolean {
  const maxLevel = MAX_LEVELS[member.rarity] || 40;
  const isEvolved = (member.evolution_stage ?? 0) >= 1;
  return member.level >= maxLevel && !isEvolved;
}

/** 進化後のステータスを計算（HP/ATK/DEF/SPDを約30%アップ） */
export function getEvolvedStats(member: Member): { hp: number; max_hp: number; attack: number; defense: number; speed: number } {
  const mult = EVOLUTION_STAT_MULTIPLIER;
  return {
    hp: Math.floor(member.hp * mult),
    max_hp: Math.floor(member.max_hp * mult),
    attack: Math.floor(member.attack * mult),
    defense: Math.floor(member.defense * mult),
    speed: Math.floor(member.speed * mult)
  };
}
