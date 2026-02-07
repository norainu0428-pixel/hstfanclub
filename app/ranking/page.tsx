'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface RankingEntry {
  rank: number;
  user_id: string;
  display_name: string;
  rating: number;
  wins: number;
  losses: number;
  total_battles: number;
  win_rate: number;
  highest_cleared_stage: number;
}

export default function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [myRanking, setMyRanking] = useState<RankingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadRankings();
  }, []);

  async function loadRankings() {
    const { data: { user } } = await supabase.auth.getUser();

    // トップ100取得
    const { data } = await supabase
      .from('pvp_stats')
      .select(`
        user_id,
        rating,
        wins,
        losses,
        total_battles,
        user:profiles!pvp_stats_user_id_fkey(display_name)
      `)
      .order('rating', { ascending: false })
      .limit(100);

    if (data) {
      const userIds = data.map((e: { user_id: string }) => e.user_id);
      const { data: progressList } = await supabase
        .from('user_progress')
        .select('user_id, current_stage')
        .in('user_id', userIds);

      const stageMap = new Map<string, number>();
      (progressList || []).forEach((p: { user_id: string; current_stage?: number }) => {
        const stage = p.current_stage ?? 1;
        stageMap.set(p.user_id, Math.max(0, stage - 1));
      });

      const formatted = data.map((entry: any, index) => ({
        rank: index + 1,
        user_id: entry.user_id,
        display_name: (entry.user as any)?.display_name || '不明',
        rating: entry.rating || 1000,
        wins: entry.wins || 0,
        losses: entry.losses || 0,
        total_battles: entry.total_battles || 0,
        win_rate: entry.total_battles > 0 ? (entry.wins / entry.total_battles) * 100 : 0,
        highest_cleared_stage: stageMap.get(entry.user_id) ?? 0
      }));

      setRankings(formatted);

      // 自分のランキング取得
      if (user) {
        const myEntry = formatted.find((e: RankingEntry) => e.user_id === user.id);
        if (myEntry) {
          setMyRanking(myEntry);
        } else {
          const { data: myStats, error: myStatsError } = await supabase
            .from('pvp_stats')
            .select(`
              user_id,
              rating,
              wins,
              losses,
              total_battles,
              user:profiles!pvp_stats_user_id_fkey(display_name)
            `)
            .eq('user_id', user.id)
            .maybeSingle();

          if (myStatsError) {
            console.error('自分の戦績取得エラー:', myStatsError);
          }

          if (myStats) {
            const myStage = stageMap.get(myStats.user_id) ?? 0;
            const { data: myProgress } = await supabase
              .from('user_progress')
              .select('current_stage')
              .eq('user_id', user.id)
              .maybeSingle();
            const myHighest = myProgress?.current_stage != null
              ? Math.max(0, myProgress.current_stage - 1)
              : 0;

            setMyRanking({
              rank: 0,
              user_id: myStats.user_id,
              display_name: (myStats.user as any)?.display_name || '不明',
              rating: myStats.rating || 1000,
              wins: myStats.wins || 0,
              losses: myStats.losses || 0,
              total_battles: myStats.total_battles || 0,
              win_rate: myStats.total_battles > 0 ? (myStats.wins / myStats.total_battles) * 100 : 0,
              highest_cleared_stage: myStage ?? myHighest
            });
          }
        }
      }
    }

    setLoading(false);
  }

  function getRankIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}位`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-orange-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🏆 ランキング</h1>
          <p className="text-lg opacity-90">レーティング Top 100</p>
        </div>

        {/* 自分のランキング */}
        {myRanking && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 mb-6 shadow-2xl text-white">
            <div className="text-center mb-2">
              <div className="text-sm opacity-90">あなたの順位</div>
              <div className="text-4xl font-bold">
                {myRanking.rank > 0 ? getRankIcon(myRanking.rank) : 'ランク外'}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{myRanking.rating}</div>
                <div className="text-xs opacity-90">レーティング</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{myRanking.wins}勝</div>
                <div className="text-xs opacity-90">{myRanking.losses}敗</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{myRanking.win_rate.toFixed(1)}%</div>
                <div className="text-xs opacity-90">勝率</div>
              </div>
              <div>
                <div className="text-2xl font-bold">ステージ{myRanking.highest_cleared_stage}</div>
                <div className="text-xs opacity-90">最高クリア</div>
              </div>
            </div>
          </div>
        )}

        {/* ランキングリスト */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {rankings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              ランキングデータがありません
            </div>
          ) : (
            <div className="space-y-2">
              {rankings.map(entry => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition ${
                    entry.user_id === myRanking?.user_id
                      ? 'bg-yellow-100 border-2 border-yellow-400'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{entry.display_name}</div>
                      <div className="text-sm text-gray-500">
                        {entry.wins}勝 {entry.losses}敗（勝率 {entry.win_rate.toFixed(1)}%）
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-700">ステージ{entry.highest_cleared_stage}</div>
                      <div className="text-xs text-gray-500">最高クリア</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{entry.rating}</div>
                      <div className="text-xs text-gray-500">Rating</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="bg-white text-yellow-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
