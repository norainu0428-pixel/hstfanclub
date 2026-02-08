export type SkillType = string | null;

export interface MemberSkill {
  skill_type: SkillType;
  skill_power: number;
}

export interface GachaRate {
  id: string;
  rarity: string;
  rate: number;
  ten_pull_rate: number;
  updated_by: string | null;
  updated_at: string;
}

export interface ExtendedMember {
  name: string;
  emoji: string;
  description: string;
  skill_type: SkillType;
  skill_power: number;
}
