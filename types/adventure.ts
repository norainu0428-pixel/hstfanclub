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
  /** 0=未進化, 1=進化済み */
  evolution_stage?: number;
  evolved_at?: string | null;
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
  skill_type?: string | null;
  skill_power?: number;
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

// レベル上限設定（インフレしすぎないよう全体的に抑えめ）
export const MAX_LEVELS: { [key: string]: number } = {
  'HST': 200,
  'stary': 600,
  'legendary': 120,
  'ultra-rare': 100,
  'super-rare': 80,
  'rare': 60,
  'common': 50
};

// レベルアップ時のステータス上昇
// 「1しか上がらない」状態から、各ステータスがレベルアップごとにおおよそ 5〜10 前後上がるように調整
// 高レベル帯ではかなり数値が伸びるため、インフレ前提のバランスになります
export const LEVEL_UP_STATS: { [key: string]: { hp: number, attack: number, defense: number, speed: number } } = {
  // 高レアほど伸びやすい
  'HST':       { hp: 10, attack: 10, defense: 8, speed: 8 },
  'stary':     { hp: 9,  attack: 9,  defense: 7, speed: 7 },
  'legendary': { hp: 8,  attack: 8,  defense: 6, speed: 6 },
  'ultra-rare':{ hp: 7,  attack: 7,  defense: 5, speed: 5 },
  'super-rare':{ hp: 6,  attack: 6,  defense: 4, speed: 4 },
  'rare':      { hp: 5,  attack: 5,  defense: 3, speed: 3 },
  'common':    { hp: 4,  attack: 4,  defense: 2, speed: 2 }
};

/**
 * Lv1 時の初期ステータス（ガチャ・付与・参照用の正の値）。
 * すたーりー(stary): hp 200, attack 65, defense 30, speed 40 を基準にし、他はここを参照すること。
 */
export const INITIAL_STATS: { [key: string]: { hp: number; attack: number; defense: number; speed: number } } = {
  'HST':       { hp: 300, attack: 100, defense: 50, speed: 60 },
  'stary':     { hp: 200, attack: 65, defense: 30, speed: 40 },
  'legendary': { hp: 150, attack: 45, defense: 20, speed: 25 },
  'ultra-rare':{ hp: 120, attack: 35, defense: 15, speed: 20 },
  'super-rare':{ hp: 100, attack: 28, defense: 12, speed: 15 },
  'rare':      { hp: 80, attack: 22, defense: 10, speed: 12 },
  'common':    { hp: 60, attack: 16, defense: 8, speed: 10 }
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
