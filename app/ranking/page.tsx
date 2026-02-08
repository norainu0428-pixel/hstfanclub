'use client';
/**
 * ランキング（最高到達ステージ）
 * user_progress.current_stage で降順 Top100。自分の順位も表示。
 * user_progress のランキング用 SELECT は supabase_ranking_stage.sql で許可。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface RankingEntry {
  rank: number;
  user_id: string;
  display_name: string;
  current_stage: number;
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

    // トップ100取得（最高到達ステージ = current_stage の降順）
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id, current_stage')
      .order('current_stage', { ascending: false })
      .limit(100);

    if (progressError) {
      console.error('ランキング取得エラー:', progressError);
      setLoading(false);
      return;
    }

    if (progressData && progressData.length > 0) {
      const userIds = [...new Set(progressData.map((p: any) => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const nameMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.display_name || '不明']));

      const formatted: RankingEntry[] = progressData.map((entry: any, index) => ({
        rank: index + 1,
        user_id: entry.user_id,
        display_name: nameMap.get(entry.user_id) || '不明',
        current_stage: entry.current_stage ?? 1
      }));

      setRankings(formatted);

      if (user) {
        const myEntry = formatted.find((e: RankingEntry) => e.user_id === user.id);
        if (myEntry) {
          setMyRanking(myEntry);
        } else {
          const { data: myProgress } = await supabase
            .from('user_progress')
            .select('user_id, current_stage')
            .eq('user_id', user.id)
            .maybeSingle();

          if (myProgress) {
            const { data: myProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', user.id)
              .maybeSingle();
            setMyRanking({
              rank: 0,
              user_id: myProgress.user_id,
              display_name: myProfile?.display_name || '不明',
              current_stage: myProgress.current_stage ?? 1
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
          <p className="text-lg opacity-90">最高到達ステージ Top 100</p>
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
            <div className="text-center">
              <div className="text-3xl font-bold">ステージ {myRanking.current_stage}</div>
              <div className="text-sm opacity-90">最高到達ステージ</div>
            </div>
          </div>
        )}

        {/* ランキングリスト */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {rankings.length === 0 ? (
            <div className="text-center py-12 text-gray-900">
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
                      <div className="text-sm text-gray-900">ステージ {entry.current_stage} 到達</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">ステージ {entry.current_stage}</div>
                    <div className="text-xs text-gray-900">最高到達</div>
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
