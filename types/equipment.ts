export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';
export type EquipmentRarity = 'common' | 'rare' | 'super-rare' | 'ultra-rare' | 'legendary';

export interface EquipmentMaster {
  id: string;
  name: string;
  emoji: string;
  slot_type: EquipmentSlot;
  rarity: EquipmentRarity;
  base_atk: number;
  base_def: number;
  base_hp: number;
  base_spd: number;
  per_level_atk: number;
  per_level_def: number;
  per_level_hp: number;
  per_level_spd: number;
  max_level: number;
  /** 武器スキル（Lv5で解放） */
  weapon_skill_type?: string | null;
  weapon_skill_power?: number | null;
}

export interface UserEquipment {
  id: string;
  user_id: string;
  equipment_id: string;
  level: number;
  equipped_member_id: string | null;
  obtained_at: string;
  equipment?: EquipmentMaster;
}

export interface EquipmentStats {
  atk: number;
  def: number;
  hp: number;
  spd: number;
}
