import type { EquipmentMaster, EquipmentStats } from '@/types/equipment';

export function getEquipmentStats(master: EquipmentMaster, level: number): EquipmentStats {
  const levelBonus = Math.max(0, level - 1);
  return {
    atk: master.base_atk + master.per_level_atk * levelBonus,
    def: master.base_def + master.per_level_def * levelBonus,
    hp: master.base_hp + master.per_level_hp * levelBonus,
    spd: master.base_spd + master.per_level_spd * levelBonus
  };
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'from-yellow-500 to-orange-500';
    case 'ultra-rare': return 'from-purple-500 to-pink-500';
    case 'super-rare': return 'from-purple-400 to-blue-400';
    case 'rare': return 'from-blue-500 to-cyan-500';
    default: return 'from-gray-400 to-gray-500';
  }
}
