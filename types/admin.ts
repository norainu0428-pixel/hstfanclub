export interface AdminStats {
  totalUsers: number;
  freeUsers: number;
  basicUsers: number;
  premiumUsers: number;
  totalPoints: number;
  totalBattles: number;
  activeUsers: number;
}

export interface UserWithProfile {
  user_id: string;
  email?: string;
  display_name: string | null;
  role: string;
  membership_tier?: string;
  points: number;
  is_disabled?: boolean;
  created_at: string;
  last_sign_in_at?: string;
  /** 経験値アップコースのボーナス挑戦回数（1日5回に加算される） */
  level_training_bonus_plays?: number;
}

export interface PointHistory {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  admin_id: string | null;
  created_at: string;
  user_name?: string;
  admin_name?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
