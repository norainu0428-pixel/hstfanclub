/**
 * 攻撃ダメージ計算
 * 攻撃力に応じた最低保証ダメージ＋乱数で、見合った攻撃力を実現
 */
export function calculateDamage(attack: number, defense: number): number {
  const baseDamage = attack - defense;
  // 攻撃力の40%を最低保証（防御で完全に消されない）
  const minDamage = Math.floor(attack * 0.4);
  // 乱数0-17を加算（以前の0-9より拡大）
  const damage = Math.max(baseDamage, minDamage) + Math.floor(Math.random() * 18);
  return Math.max(damage, 1);
}
