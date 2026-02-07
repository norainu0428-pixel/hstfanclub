import { Member, LEVEL_UP_STATS, MAX_LEVELS, getRequiredExp, LevelUpResult } from '@/types/adventure';
import { getTalentGrowthMultiplier } from '@/utils/memberStats';

export function calculateLevelUp(member: Member, gainedExp: number): {
  updatedMember: Member;
  levelUps: LevelUpResult[];
} {
  let currentMember = { ...member };
  const levelUps: LevelUpResult[] = [];
  
  // 経験値を加算
  currentMember.experience += gainedExp;
  
  // 最大レベル取得
  const maxLevel = MAX_LEVELS[currentMember.rarity] || 40;
  
  // 才能値による成長倍率（0.5〜1.5）
  const talentMultiplier = getTalentGrowthMultiplier(member.talent_value ?? 50);
  
  // レベルアップ判定（複数回レベルアップする可能性あり）
  // 無限ループを防ぐため、最大レベルアップ回数を制限（安全のため）
  let levelUpCount = 0;
  const maxLevelUps = 1000; // 実用的には到達しない値だが、安全のため
  
  while (currentMember.level < maxLevel && levelUpCount < maxLevelUps) {
    const requiredExp = getRequiredExp(currentMember.level);
    
    if (currentMember.experience >= requiredExp) {
      // レベルアップ！
      const oldLevel = currentMember.level;
      currentMember.level += 1;
      currentMember.experience -= requiredExp;
      levelUpCount++;
      
      // ステータス上昇（才能値で倍率適用）
      const baseStats = LEVEL_UP_STATS[currentMember.rarity] || LEVEL_UP_STATS['common'];
      const stats = {
        hp: Math.max(1, Math.floor(baseStats.hp * talentMultiplier)),
        attack: Math.max(1, Math.floor(baseStats.attack * talentMultiplier)),
        defense: Math.max(1, Math.floor(baseStats.defense * talentMultiplier)),
        speed: Math.max(1, Math.floor(baseStats.speed * talentMultiplier))
      };
      
      currentMember.hp += stats.hp;
      currentMember.max_hp += stats.hp;
      currentMember.attack += stats.attack;
      currentMember.defense += stats.defense;
      currentMember.speed += stats.speed;
      
      // レベルアップ記録
      levelUps.push({
        member_id: currentMember.id,
        old_level: oldLevel,
        new_level: currentMember.level,
        stat_gains: {
          hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          speed: stats.speed
        }
      });
    } else {
      break;
    }
  }
  
  // レベルアップ回数が上限に達した場合の警告（デバッグ用）
  if (levelUpCount >= maxLevelUps) {
    console.warn(`レベルアップ回数が上限に達しました: ${levelUpCount}回`);
  }
  
  return { updatedMember: currentMember, levelUps };
}
