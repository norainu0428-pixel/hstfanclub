import { supabase } from '@/lib/supabaseClient';
import type { EquipmentMaster } from '@/types/equipment';

/** エクストラステージ勝利時の装備ドロップ確率（%） */
const DROP_RATE_PERCENT = 0.5;

/** レア以上の装備のみドロップ（commonは除外） */
const DROP_RARITIES = ['rare', 'super-rare', 'ultra-rare', 'legendary'] as const;

/** レアリティ別の重み（レアほど出やすく、レジェンドは稀） */
const RARITY_WEIGHTS: Record<string, number> = {
  'rare': 50,
  'super-rare': 30,
  'ultra-rare': 15,
  'legendary': 5
};

/**
 * エクストラステージ勝利時にレア装備を低確率でドロップする
 * @returns ドロップした装備、またはnull
 */
export async function tryDropEquipmentFromExtraStage(userId: string): Promise<EquipmentMaster | null> {
  if (Math.random() * 100 >= DROP_RATE_PERCENT) return null;

  const { data: equipmentList } = await supabase
    .from('equipment_master')
    .select('*')
    .in('rarity', DROP_RARITIES);

  if (!equipmentList || equipmentList.length === 0) return null;

  const roll = Math.random() * 100;
  let acc = 0;
  let selectedRarity = 'rare';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    acc += weight;
    if (roll < acc) {
      selectedRarity = rarity;
      break;
    }
  }

  const byRarity = equipmentList.filter((e: EquipmentMaster) => e.rarity === selectedRarity);
  const equipment = byRarity.length > 0
    ? byRarity[Math.floor(Math.random() * byRarity.length)]
    : equipmentList[Math.floor(Math.random() * equipmentList.length)];

  const { error } = await supabase
    .from('user_equipment')
    .insert({
      user_id: userId,
      equipment_id: equipment.id,
      level: 1
    });

  if (error) {
    console.error('装備ドロップ挿入エラー:', error);
    return null;
  }

  return equipment as EquipmentMaster;
}
