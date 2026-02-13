/**
 * レアリティ表示の統一ユーティリティ
 * 全画面で一貫したわかりやすい表記を使用
 * ランク: ★7(最上位) ～ ★1(最下位)
 */

export type RarityType = '覚醒' | 'HST' | 'stary' | 'legendary' | 'ultra-rare' | 'super-rare' | 'rare' | 'common';

// レア度（高いほどレア・8が最上位）
export const RARITY_RANK: Record<string, number> = {
  '覚醒': 8,
  'HST': 7,
  'stary': 6,
  'legendary': 5,
  'ultra-rare': 4,
  'super-rare': 3,
  'rare': 2,
  'common': 1
};

// ランク星表示（★8～★1）
const RARITY_STAR: Record<string, string> = {
  '覚醒': '★8',
  'HST': '★7',
  'stary': '★6',
  'legendary': '★5',
  'ultra-rare': '★4',
  'super-rare': '★3',
  'rare': '★2',
  'common': '★1'
};

/** 日本語・DBの表記揺れ → 英語キーに正規化（共通で使用） */
export function normalizeRarity(rarity: string): string {
  if (!rarity || typeof rarity !== 'string') return rarity;
  const n = rarity.trim().toLowerCase();
  const map: Record<string, string> = {
    '覚醒': '覚醒', 'hst': 'HST', 'stary': 'stary', 'STARY': 'stary',
    'レジェンド': 'legendary', 'legendary': 'legendary',
    'ウルトラレア': 'ultra-rare', 'ultra-rare': 'ultra-rare', 'ultrare': 'ultra-rare', 'ultra_rare': 'ultra-rare',
    'スーパーレア': 'super-rare', 'super-rare': 'super-rare', 'superrare': 'super-rare', 'super_rare': 'super-rare',
    'レア': 'rare', 'rare': 'rare',
    'コモン': 'common', 'common': 'common', 'ノーマル': 'common',
    '★1': 'common', '★2': 'rare', '★3': 'super-rare', '★4': 'ultra-rare', '★5': 'legendary', '★6': 'stary', '★7': 'HST', '★8': '覚醒'
  };
  return map[n] ?? map[rarity] ?? rarity;
}

/**
 * フル表示用（ガチャ結果・詳細表示など）
 * ランク＋名前で階級が一目でわかる表記
 */
export function getRarityLabel(rarity: string): string {
  const key = normalizeRarity(rarity);
  const labels: Record<string, string> = {
    '覚醒': '★8 覚醒',
    'HST': '★7 HST（最上位）',
    'stary': '★6 STARY（伝説）',
    'legendary': '★5 レジェンド',
    'ultra-rare': '★4 ウルトラレア',
    'super-rare': '★3 スーパーレア',
    'rare': '★2 レア',
    'common': '★1 コモン'
  };
  return labels[key] ?? labels[rarity] ?? `★? ${rarity}`;
}

/**
 * 短縮表示用（カード・10連結果などコンパクトな表示）
 * ランクのみで階級が一目瞭然（★7～★1）
 */
export function getRarityShortLabel(rarity: string): string {
  const key = normalizeRarity(rarity);
  return RARITY_STAR[key] ?? RARITY_STAR[rarity] ?? `★? ${rarity}`;
}

/**
 * 中程度の表示用（ランク＋名前）
 */
export function getRarityMediumLabel(rarity: string): string {
  const labels: Record<string, string> = {
    '覚醒': '★8 覚醒',
    'HST': '★7 HST',
    'stary': '★6 STARY',
    'legendary': '★5 レジェンド',
    'ultra-rare': '★4 UR',
    'super-rare': '★3 SR',
    'rare': '★2 レア',
    'common': '★1 コモン'
  };
  const key = normalizeRarity(rarity);
  return labels[key] ?? labels[rarity] ?? `${RARITY_STAR[key] ?? RARITY_STAR[rarity] ?? '★?'} ${rarity}`;
}

/**
 * 管理画面・確率表用（絵文字＋ランク付き）
 */
export function getRarityLabelWithEmoji(rarity: string): string {
  const key = normalizeRarity(rarity);
  const labels: Record<string, string> = {
    '覚醒': '🌟 ★8 覚醒',
    'HST': '👑 ★7 HST（最上位）',
    'stary': '🌠 ★6 STARY（伝説）',
    'legendary': '🏆 ★5 レジェンド',
    'ultra-rare': '💎 ★4 ウルトラレア',
    'super-rare': '⭐ ★3 スーパーレア',
    'rare': '✨ ★2 レア',
    'common': '📦 ★1 コモン'
  };
  return labels[key] ?? labels[rarity] ?? rarity;
}

/**
 * 背景色クラス（Tailwind）
 */
export function getRarityColorClass(rarity: string): string {
  const key = normalizeRarity(rarity);
  switch (key) {
    case '覚醒': return 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500';
    case 'HST': return 'bg-gradient-to-r from-yellow-600 via-orange-600 to-red-600';
    case 'stary': return 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500';
    case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500';
    case 'ultra-rare': return 'bg-gradient-to-r from-purple-500 to-pink-500';
    case 'super-rare': return 'bg-purple-500';
    case 'rare': return 'bg-blue-500';
    case 'common': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
}

/**
 * グラデーション部分のみ（bg-gradient-to-br 等と組み合わせる用）
 */
export function getRarityGradientPart(rarity: string): string {
  const key = normalizeRarity(rarity);
  switch (key) {
    case '覚醒': return 'from-amber-400 via-yellow-500 to-orange-500';
    case 'HST': return 'from-yellow-600 via-orange-600 to-red-600';
    case 'stary': return 'from-pink-500 via-purple-500 to-blue-500';
    case 'legendary': return 'from-yellow-400 to-orange-500';
    case 'ultra-rare': return 'from-purple-500 to-pink-500';
    case 'super-rare': return 'from-purple-600 to-purple-400';
    case 'rare': return 'from-blue-500 to-blue-400';
    case 'common': return 'from-gray-400 to-gray-300';
    default: return 'from-gray-400 to-gray-300';
  }
}

/**
 * ボーダー色（HEX）
 */
export function getRarityBorderColor(rarity: string): string {
  const key = normalizeRarity(rarity);
  const colors: Record<string, string> = {
    '覚醒': '#fbbf24',
    'HST': '#f59e0b',
    'stary': '#ec4899',
    'legendary': '#f59e0b',
    'ultra-rare': '#a855f7',
    'super-rare': '#8b5cf6',
    'rare': '#3b82f6',
    'common': '#6b7280'
  };
  return colors[key] ?? colors[rarity] ?? '#6b7280';
}

/**
 * レアリティ選択肢（フィルター用）
 * ランク順（高い→低い）
 */
export const RARITY_FILTER_OPTIONS = [
  { value: '覚醒', label: '★8 覚醒' },
  { value: 'HST', label: '★7 HST（最上位）' },
  { value: 'stary', label: '★6 STARY（伝説）' },
  { value: 'legendary', label: '★5 レジェンド' },
  { value: 'ultra-rare', label: '★4 ウルトラレア' },
  { value: 'super-rare', label: '★3 スーパーレア' },
  { value: 'rare', label: '★2 レア' },
  { value: 'common', label: '★1 コモン' }
] as const;
