export type Rarity = 'HST' | 'stary' | 'legendary' | 'ultra-rare' | 'super-rare' | 'rare' | 'common';

export interface Member {
  id: string;
  user_id: string;
  member_name: string;
  member_emoji: string;
  member_description: string;
  rarity: Rarity;
  level: number;
  experience: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  speed: number;
  obtained_at: string;
  is_favorite: boolean;
  locked?: boolean;
  skill_type?: string | null;
  skill_power?: number;
  revive_used?: boolean;
  current_hp?: number;
}

export interface Enemy {
  name: string;
  emoji: string;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  speed: number;
  experience_reward: number;
  points_reward: number;
}

export interface BattleAction {
  type: 'attack' | 'defend' | 'skill';
  attacker: string;
  target: string;
  damage: number;
  message: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  current_stage: number;
  total_battles: number;
  total_victories: number;
  total_defeats: number;
  highest_damage: number;
  created_at: string;
  updated_at: string;
}

// レベル上限設定
export const MAX_LEVELS: { [key: string]: number } = {
  'HST': 999,
  'stary': 500,
  'legendary': 100,
  'ultra-rare': 80,
  'super-rare': 60,
  'rare': 50,
  'common': 40
};

// レベルアップ時のステータス上昇
export const LEVEL_UP_STATS: { [key: string]: { hp: number, attack: number, defense: number, speed: number } } = {
  'HST': { hp: 20, attack: 5, defense: 4, speed: 4 },
  'stary': { hp: 20, attack: 5, defense: 4, speed: 4 },
  'legendary': { hp: 15, attack: 4, defense: 3, speed: 3 },
  'ultra-rare': { hp: 12, attack: 3, defense: 2, speed: 2 },
  'super-rare': { hp: 10, attack: 2, defense: 2, speed: 2 },
  'rare': { hp: 8, attack: 2, defense: 1, speed: 1 },
  'common': { hp: 6, attack: 1, defense: 1, speed: 1 }
};

// 必要経験値計算
export function getRequiredExp(currentLevel: number): number {
  if (currentLevel < 10) {
    return currentLevel * 100;
  } else if (currentLevel < 30) {
    return currentLevel * 150;
  } else if (currentLevel < 50) {
    return currentLevel * 200;
  } else if (currentLevel < 100) {
    return currentLevel * 300;
  } else {
    return currentLevel * 500;
  }
}

// レベルアップ結果
export interface LevelUpResult {
  member_id: string;
  old_level: number;
  new_level: number;
  stat_gains: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
}
