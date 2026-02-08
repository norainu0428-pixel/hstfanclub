/**
 * スキル定義（100種類）
 * プログラムとして実装済み。メンバーに割り当てる必要はない。
 */

export type SkillTargetType = 'none' | 'ally' | 'ally_all' | 'enemy' | 'enemy_all';

export const SKILL_NAMES: Record<string, string> = {
  // 攻撃系 1-25
  power_strike: '威力抜撃',
  double_strike: '連撃',
  triple_strike: '三連撃',
  aoe_attack: '全体攻撃',
  pierce_attack: '貫通攻撃',
  poison_blade: '毒刃',
  fire_strike: '炎の一撃',
  ice_strike: '氷結斬',
  thunder_strike: '雷撃',
  dark_strike: '闇の裁き',
  critical_strike: '必殺の一撃',
  drain_attack: '吸血攻撃',
  counter_prep: '反撃準備',
  kamikaze: '捨て身の一撃',
  execute: '弱点突き',
  finish: '追い打ち',
  blade_storm: 'ブレードストーム',
  quake: '地裂斬',
  spin_attack: 'スピンアタック',
  poison_cloud: '毒霧',
  explosion: '爆発',
  push: '押し出し',
  restrain: '牽制',
  intimidate: '威嚇',
  curse_damage: '呪い',

  // 回復・防御系 26-45
  heal: 'HP回復',
  all_heal: '全体回復',
  big_heal: '大回復',
  revive: '自己蘇生',
  regen: '再生',
  all_defense: '全体防御',
  defense_boost: '防御強化',
  barrier: 'バリア',
  reflect_shield: '反射盾',
  purify: '浄化',
  prayer: '祈り',
  first_aid: '応急手当',
  life_spring: '生命の泉',
  iron_wall: '鉄壁',
  endure: '不屈',
  revive_light: '復活の祈り',
  holy_light: '癒しの光',
  regen_long: 'リジェネ',
  fortress: '結界',
  holy_guard: '神聖なる守り',

  // バフ系 46-60
  attack_boost: '攻撃強化',
  all_attack: '全体攻撃アップ',
  speed_boost: '素早さアップ',
  quick: 'クイック',
  rally: '鼓舞',
  focus: '集中',
  spirit: '闘志',
  haste: '加速',
  double_turn: '神速',
  awaken: '覚醒',
  lucky: 'ラッキー',
  might: '剛力',
  fortify: '堅陣',
  morale: '士気高揚',
  berserk: 'バーサーク',

  // デバフ系 61-75
  attack_down: '攻撃ダウン',
  defense_down: '防御ダウン',
  poison: '毒',
  paralyze: '麻痺',
  sleep: '睡眠',
  confusion: '混乱',
  freeze: '凍結',
  silence: '沈黙',
  slow: '鈍足',
  curse: '呪縛',
  shrink: '萎縮',
  fear: '恐怖',
  blind: '盲目',
  bleed: '出血',
  weaken: '衰弱',

  // 特殊・ユニーク系 76-100
  hst_power: 'HSTパワー',
  time_stop: '時間停止',
  copy: 'コピー',
  damage_reflect: 'ダメージ反射',
  insta_kill: '確率即死',
  hp_drain: 'HP吸収',
  convert: '転換',
  miracle: '奇跡',
  last_resort: 'ラストリゾート',
  counter: 'カウンター',
  preemptive: '先制攻撃',
  dual_wield: '二刀流',
  flash: '一閃',
  sacrifice: '捨て身',
  cheer: '応援',
  chain: 'チェイン',
  overheat: 'オーバーヒート',
  mirage: 'ミラージュ',
  revenge: 'リベンジ',
  lucky_star: 'ラッキースター',
  echo: 'エコー',
  summon: 'サモン',
  aura: 'オーラ',
  last_awaken: '最終覚醒',
};

export function getSkillName(skillType: string | null | undefined): string {
  if (!skillType) return '';
  return SKILL_NAMES[skillType] || skillType;
}

/** 敵をターゲットに必要とするスキル */
export const SKILLS_NEED_ENEMY_TARGET = new Set([
  'power_strike', 'double_strike', 'triple_strike', 'pierce_attack', 'poison_blade',
  'fire_strike', 'ice_strike', 'thunder_strike', 'dark_strike', 'critical_strike',
  'drain_attack', 'execute', 'finish', 'push', 'restrain', 'intimidate', 'curse_damage',
  'attack_down', 'defense_down', 'poison', 'paralyze', 'sleep', 'confusion', 'freeze',
  'silence', 'slow', 'curse', 'shrink', 'fear', 'blind', 'bleed', 'weaken',
  'insta_kill', 'hp_drain', 'flash', 'dual_wield'
]);

/** 味方をターゲットに必要とするスキル */
export const SKILLS_NEED_ALLY_TARGET = new Set([
  'heal', 'big_heal', 'first_aid', 'holy_guard', 'fortress', 'cheer'
]);
