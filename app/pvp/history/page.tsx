'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface BattleHistory {
  id: string;
  opponent_name: string;
  result: 'win' | 'loss' | 'draw';
  my_rating_change: number;
  created_at: string;
}

export default function PvPHistoryPage() {
  const [history, setHistory] = useState<BattleHistory[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 戦績取得
    const { data: statsData, error: statsError } = await supabase
      .from('pvp_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (statsError) {
      console.error('戦績取得エラー:', statsError);
    }

    setStats(statsData);

    // 対戦履歴取得
    const { data: battles } = await supabase
      .from('pvp_battles')
      .select(`
        id,
        player1_id,
        player2_id,
        winner_id,
        created_at,
        player1:profiles!pvp_battles_player1_id_fkey(display_name),
        player2:profiles!pvp_battles_player2_id_fkey(display_name)
      `)
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (battles) {
      const formatted = battles.map((battle: any) => {
        const isPlayer1 = battle.player1_id === user.id;
        const opponentName = isPlayer1 
          ? battle.player2?.display_name || '不明'
          : battle.player1?.display_name || '不明';
        
        const result: 'win' | 'loss' | 'draw' = battle.winner_id === user.id 
          ? 'win' 
          : battle.winner_id 
            ? 'loss' 
            : 'draw';

        const ratingChange = result === 'win' ? 25 : result === 'loss' ? -15 : 0;

        return {
          id: battle.id,
          opponent_name: opponentName,
          result,
          my_rating_change: ratingChange,
          created_at: battle.created_at
        };
      });

      setHistory(formatted);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">📊 対戦履歴</h1>
        </div>

        {/* 戦績サマリー */}
        {stats && (
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl text-gray-900">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">戦績</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{stats.total_battles || 0}</div>
                <div className="text-sm text-gray-800">総戦闘数</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{stats.wins || 0}</div>
                <div className="text-sm text-gray-800">勝利</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{stats.losses || 0}</div>
                <div className="text-sm text-gray-800">敗北</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{stats.rating || 1000}</div>
                <div className="text-sm text-gray-800">レーティング</div>
              </div>
            </div>
            <div className="mt-4 text-center text-gray-900">
              <div className="text-lg">
                勝率: <span className="font-bold text-blue-600">
                  {stats.total_battles > 0 ? ((stats.wins / stats.total_battles) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 対戦履歴 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
          <h2 className="text-xl font-bold mb-4 text-gray-900">最近の対戦</h2>
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-800">
              対戦履歴がありません
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(battle => (
                <div
                  key={battle.id}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                      battle.result === 'win' 
                        ? 'bg-green-100 text-green-600' 
                        : battle.result === 'loss'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {battle.result === 'win' ? '🎉' : battle.result === 'loss' ? '😢' : '🤝'}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900">
                        vs {battle.opponent_name}
                      </div>
                      <div className="text-sm text-gray-800">
                        {new Date(battle.created_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${
                      battle.result === 'win' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {battle.result === 'win' ? '勝利' : battle.result === 'loss' ? '敗北' : '引き分け'}
                    </div>
                    <div className={`text-sm ${
                      battle.my_rating_change > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {battle.my_rating_change > 0 ? '+' : ''}{battle.my_rating_change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/friends')}
            className="bg-white text-purple-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            フレンド一覧に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
