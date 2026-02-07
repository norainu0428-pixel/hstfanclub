/**
 * 攻撃ダメージ計算（元の計算式）
 */
export function calculateDamage(attack: number, defense: number): number {
  const baseDamage = attack - defense;
  return Math.max(baseDamage + Math.floor(Math.random() * 10), 1);
}
