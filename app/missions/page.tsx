'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { initializeDailyMissions, claimMissionReward } from '@/utils/missionTracker';

interface Mission {
  id: string;
  mission_type: string;
  title: string;
  description: string;
  target_count: number;
  reward_points: number;
  reward_exp: number;
  difficulty: string;
}

interface MissionProgress {
  id: string;
  mission_id: string;
  current_count: number;
  completed: boolean;
  claimed: boolean;
  mission: Mission;
}

export default function MissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<MissionProgress[]>([]);
  const [currentPoints, setCurrentPoints] = useState(0);

  useEffect(() => {
    loadMissions();
  }, []);

  async function loadMissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      // デイリーミッションを初期化
      await initializeDailyMissions(user.id);

      // ポイント取得
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('プロフィール取得エラー:', profileError);
      } else if (profile) {
        setCurrentPoints(profile.points || 0);
      }

      // 今日の日付
      const today = new Date().toISOString().split('T')[0];

      // ミッションと進捗を取得
      const { data: progressData } = await supabase
        .from('user_mission_progress')
        .select(`
          *,
          mission:daily_missions(*)
        `)
        .eq('user_id', user.id)
        .eq('mission_date', today)
        .order('mission_id');

      if (progressData) {
        const formattedMissions: MissionProgress[] = progressData
          .filter((p: any) => p.mission != null)
          .map((p: any) => ({
            id: p.id,
            mission_id: p.mission_id,
            current_count: p.current_count,
            completed: p.completed,
            claimed: p.claimed,
            mission: p.mission
          }));
        setMissions(formattedMissions);
      }
    } catch (error) {
      console.error('ミッション読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimReward(progress: MissionProgress) {
    if (!progress.completed || progress.claimed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await claimMissionReward(
      user.id,
      progress.id,
      progress.mission.reward_points,
      progress.mission.reward_exp
    );

    if (result.success) {
      alert(result.message);
      // 再読み込み
      await loadMissions();
    } else {
      alert(result.message);
    }
  }

  async function handleClaimAllRewards() {
    const claimable = missions.filter(m => m.completed && !m.claimed);
    if (claimable.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let totalPoints = 0;
    let totalExp = 0;
    for (const progress of claimable) {
      const result = await claimMissionReward(
        user.id,
        progress.id,
        progress.mission.reward_points,
        progress.mission.reward_exp
      );
      if (result.success) {
        totalPoints += progress.mission.reward_points;
        totalExp += progress.mission.reward_exp;
      }
    }
    alert(`${claimable.length}件の報酬を受け取りました！\n💰 ${totalPoints}pt\n⭐ ${totalExp}EXP`);
    await loadMissions();
  }

  function getDifficultyColor(difficulty: string) {
    switch (difficulty) {
      case 'easy': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'normal': return 'bg-orange-500/30 text-orange-300 border-orange-500/50';
      case 'hard': return 'bg-orange-600/30 text-orange-200 border-orange-600/50';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  }

  function getDifficultyName(difficulty: string) {
    switch (difficulty) {
      case 'easy': return '簡単';
      case 'normal': return '普通';
      case 'hard': return '困難';
      default: return difficulty;
    }
  }

  function getMissionIcon(missionType: string) {
    switch (missionType) {
      case 'battle_win': return '⚔️';
      case 'battle_complete': return '🗡️';
      case 'gacha_pull': return '🎰';
      case 'stage_clear': return '🏆';
      case 'level_up': return '📈';
      default: return '📋';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 text-xl">読み込み中...</div>
      </div>
    );
  }

  const completedCount = missions.filter(m => m.completed).length;
  const totalMissions = missions.length;
  const progressPercent = totalMissions > 0 ? (completedCount / totalMissions) * 100 : 0;
  const claimableCount = missions.filter(m => m.completed && !m.claimed).length;

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2 text-orange-500">📋 デイリーミッション</h1>
          <p className="text-lg text-gray-300">毎日のミッションをクリアして報酬を獲得しよう！</p>
          <div className="mt-4 bg-gray-900 border border-orange-500/30 rounded-lg px-6 py-3 inline-block shadow-lg shadow-orange-500/10">
            <div className="text-2xl font-bold text-orange-500">{currentPoints}pt</div>
            <div className="text-sm text-gray-300">現在のポイント</div>
          </div>
        </div>

        {/* 進捗サマリー */}
        <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 shadow-2xl shadow-orange-500/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">今日の進捗</h2>
            <div className="text-lg font-bold text-orange-500">
              {completedCount} / {totalMissions} 完了
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-4 gap-4">
            <div className="text-sm text-gray-300">
              {progressPercent.toFixed(0)}% 完了
            </div>
            {claimableCount > 0 && (
              <button
                onClick={handleClaimAllRewards}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:scale-105 transition shadow-lg shadow-orange-500/30"
              >
                🎁 すべて受け取る（{claimableCount}件）
              </button>
            )}
          </div>
        </div>

        {/* ミッション一覧 */}
        <div className="space-y-4 mb-6">
          {missions.length === 0 ? (
            <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-8 text-center shadow-2xl shadow-orange-500/10">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-300">今日のミッションはありません</p>
            </div>
          ) : (
            missions.map((progress) => {
              const mission = progress.mission;
              const progressPercent = (progress.current_count / mission.target_count) * 100;
              const isCompleted = progress.completed;
              const isClaimed = progress.claimed;

              return (
                <div
                  key={progress.id}
                  className={`bg-gray-900 border-2 rounded-2xl p-6 shadow-2xl shadow-orange-500/10 ${
                    isCompleted
                      ? isClaimed
                        ? 'border-orange-500/20 opacity-75'
                        : 'border-orange-500 bg-orange-500/10'
                      : 'border-orange-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-4xl">{getMissionIcon(mission.mission_type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-white">{mission.title}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold border ${getDifficultyColor(
                              mission.difficulty
                            )}`}
                          >
                            {getDifficultyName(mission.difficulty)}
                          </span>
                        </div>
                        <p className="text-gray-300 mb-3">{mission.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-gray-300">
                            進捗: <span className="font-bold text-orange-400">
                              {progress.current_count} / {mission.target_count}
                            </span>
                          </div>
                          <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-xs">
                            <div
                              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {isCompleted && !isClaimed ? (
                        <button
                          onClick={() => handleClaimReward(progress)}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:scale-105 transition shadow-lg shadow-orange-500/30"
                        >
                          🎁 報酬受け取り
                        </button>
                      ) : isClaimed ? (
                        <div className="bg-gray-800 text-gray-300 border border-gray-700 px-6 py-3 rounded-lg font-bold">
                          ✓ 受け取り済み
                        </div>
                      ) : (
                        <div className="text-gray-400 text-sm">未達成</div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-3 mt-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      {mission.reward_points > 0 && (
                        <div className="flex items-center gap-1 text-orange-400 font-bold">
                          <span>💰</span>
                          <span>{mission.reward_points}pt</span>
                        </div>
                      )}
                      {mission.reward_exp > 0 && (
                        <div className="flex items-center gap-1 text-orange-300 font-bold">
                          <span>⭐</span>
                          <span>{mission.reward_exp}EXP</span>
                        </div>
                      )}
                    </div>
                    {isCompleted && (
                      <div className="text-orange-500 font-bold flex items-center gap-1">
                        <span>✓</span>
                        <span>完了！</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 戻るボタン */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-gray-800 text-orange-500 border border-orange-500 px-8 py-3 rounded-lg font-bold hover:bg-gray-700 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
