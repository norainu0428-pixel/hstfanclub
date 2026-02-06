export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  friend_profile?: {
    display_name: string;
    avatar_url?: string;
    is_online: boolean;
    last_seen_at: string;
  };
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender_profile?: {
    display_name: string;
    avatar_url?: string;
  };
}

export interface PvPBattle {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_party: string[];
  player2_party: string[];
  winner_id: string | null;
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  turn_number: number;
  current_turn_player: string;
  created_at: string;
  completed_at?: string;
}

export interface PlayerStats {
  user_id: string;
  display_name: string;
  total_battles: number;
  wins: number;
  losses: number;
  win_rate: number;
  rating: number;
  rank: number;
}
