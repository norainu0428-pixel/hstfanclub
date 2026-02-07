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

interface StageRankEntry {
  rank: number;
  user_id: string;
  display_name: string;
  highest_cleared_stage: number;
}

export default function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [stageRankings, setStageRankings] = useState<StageRankEntry[]>([]);
  const [myRanking, setMyRanking] = useState<RankingEntry | null>(null);
  const [myStageRank, setMyStageRank] = useState<StageRankEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadRankings();
  }, []);

  async function loadRankings() {
    const { data: { user } } = await supabase.auth.getUser();

    // トップ100取得（FK結合を避け、profiles は別クエリで取得）
    const { data, error } = await supabase
      .from('pvp_stats')
      .select('user_id, rating, wins, losses, total_battles')
      .order('rating', { ascending: false })
      .limit(100);

    if (error) {
      console.error('pvp_stats 取得エラー:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = data.map((e: { user_id: string }) => e.user_id);

      const [progressRes, profilesRes] = await Promise.all([
        supabase.from('user_progress').select('user_id, current_stage').in('user_id', userIds),
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
      ]);

      const stageMap = new Map<string, number>();
      (progressRes.data || []).forEach((p: { user_id: string; current_stage?: number }) => {
        const stage = p.current_stage ?? 1;
        stageMap.set(p.user_id, Math.max(0, stage - 1));
      });

      const profileMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: { user_id: string; display_name?: string }) => {
        profileMap.set(p.user_id, p.display_name || '不明');
      });

      const formatted = data.map((entry: any, index) => ({
        rank: index + 1,
        user_id: entry.user_id,
        display_name: profileMap.get(entry.user_id) || '不明',
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
            .select('user_id, rating, wins, losses, total_battles')
            .eq('user_id', user.id)
            .maybeSingle();

          if (myStatsError) {
            console.error('自分の戦績取得エラー:', myStatsError);
          }

          if (myStats) {
            const [myProgressRes, myProfileRes] = await Promise.all([
              supabase.from('user_progress').select('current_stage').eq('user_id', user.id).maybeSingle(),
              supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle()
            ]);
            const myHighest = myProgressRes.data?.current_stage != null
              ? Math.max(0, myProgressRes.data.current_stage - 1)
              : 0;

            setMyRanking({
              rank: 0,
              user_id: myStats.user_id,
              display_name: myProfileRes.data?.display_name || '不明',
              rating: myStats.rating || 1000,
              wins: myStats.wins || 0,
              losses: myStats.losses || 0,
              total_battles: myStats.total_battles || 0,
              win_rate: myStats.total_battles > 0 ? (myStats.wins / myStats.total_battles) * 100 : 0,
              highest_cleared_stage: myHighest
            });
          }
        }
      }
    }

    // 全員分・最高クリアステージランキング（user_progress を current_stage 降順で取得）
    const { data: progressList } = await supabase
      .from('user_progress')
      .select('user_id, current_stage')
      .order('current_stage', { ascending: false })
      .limit(100);

    if (progressList && progressList.length > 0) {
      const stageUserIds = progressList.map((p: { user_id: string }) => p.user_id);
      const { data: stageProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', stageUserIds);

      const stageProfileMap = new Map<string, string>();
      (stageProfiles || []).forEach((p: { user_id: string; display_name?: string }) => {
        stageProfileMap.set(p.user_id, p.display_name || '不明');
      });

      const stageFormatted: StageRankEntry[] = progressList.map((p: { user_id: string; current_stage?: number }, index: number) => {
        const stage = p.current_stage ?? 1;
        const highest = Math.max(0, stage - 1);
        return {
          rank: index + 1,
          user_id: p.user_id,
          display_name: stageProfileMap.get(p.user_id) || '不明',
          highest_cleared_stage: highest
        };
      });

      setStageRankings(stageFormatted);

      if (user) {
        const myStageEntry = stageFormatted.find((e: StageRankEntry) => e.user_id === user.id);
        if (myStageEntry) {
          setMyStageRank(myStageEntry);
        } else {
          const { data: myProg } = await supabase
            .from('user_progress')
            .select('current_stage')
            .eq('user_id', user.id)
            .maybeSingle();
          const { data: myProf } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', user.id)
            .maybeSingle();
          const myHighest = myProg?.current_stage != null ? Math.max(0, myProg.current_stage - 1) : 0;
          setMyStageRank({
            rank: 0,
            user_id: user.id,
            display_name: myProf?.display_name || '不明',
            highest_cleared_stage: myHighest
          });
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
          <p className="text-lg opacity-90">PvPレーティング & 最高クリアステージ（全員分）</p>
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

        {/* PvP レーティングランキング */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6 text-gray-900">
          <h2 className="text-xl font-bold mb-4 text-gray-900">⚔️ PvP レーティング Top 100</h2>
          {rankings.length === 0 ? (
            <div className="text-center py-12 text-gray-900">
              ランキングデータがありません
            </div>
          ) : (
            <div className="space-y-2 text-gray-900">
              {rankings.map(entry => (
                <div
                  key={'pvp-' + entry.user_id}
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
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900">{entry.display_name}</div>
                      <div className="text-sm text-gray-900">
                        {entry.wins}勝 {entry.losses}敗（勝率 {entry.win_rate.toFixed(1)}%）・最高クリア ステージ{entry.highest_cleared_stage}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-900">ステージ{entry.highest_cleared_stage}</div>
                      <div className="text-xs text-gray-900">最高クリア</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{entry.rating}</div>
                      <div className="text-xs text-gray-900">Rating</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 全員分・最高クリアステージランキング */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6 text-gray-900">
          <h2 className="text-xl font-bold mb-4 text-gray-900">📊 最高クリアステージ ランキング（全員）</h2>
          {stageRankings.length === 0 ? (
            <div className="text-center py-12 text-gray-900">
              ステージ進捗データがありません
            </div>
          ) : (
            <div className="space-y-2 text-gray-900">
              {stageRankings.map(entry => (
                <div
                  key={'stage-' + entry.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg transition ${
                    entry.user_id === myRanking?.user_id || entry.user_id === myStageRank?.user_id
                      ? 'bg-green-100 border-2 border-green-400'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-br from-green-400 to-teal-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}>
                      {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900">{entry.display_name}</div>
                      <div className="text-sm text-gray-900">最高クリア ステージ{entry.highest_cleared_stage}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700">ステージ{entry.highest_cleared_stage}</div>
                    <div className="text-xs text-gray-900">最高クリア</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 自分のステージ順位（ステージランキングにいる場合） */}
        {myStageRank && myStageRank.rank > 0 && (
          <div className="bg-white/90 rounded-xl p-4 mb-6 text-center">
            <span className="text-gray-900 font-bold">あなたのステージランキング: </span>
            <span className="text-green-700 font-bold">{myStageRank.rank}位（ステージ{myStageRank.highest_cleared_stage}）</span>
          </div>
        )}

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
