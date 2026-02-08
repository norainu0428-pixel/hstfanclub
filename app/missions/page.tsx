'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  const [claimingId, setClaimingId] = useState<string | null>(null); // 単体: progress.id / 一括: 'bulk'

  useEffect(() => {
    loadMissions();
  }, []);

  async function loadMissions() {
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
        return;
      }
    
    if (profile) {
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
      const formattedMissions: MissionProgress[] = progressData.map((p: any) => ({
        id: p.id,
        mission_id: p.mission_id,
        current_count: p.current_count,
        completed: p.completed,
        claimed: p.claimed,
        mission: p.mission
      }));
      setMissions(formattedMissions);
    }

    setLoading(false);
  }

  async function handleClaimReward(progress: MissionProgress) {
    if (!progress.completed || progress.claimed || claimingId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setClaimingId(progress.id);
    try {
      const result = await claimMissionReward(
        user.id,
        progress.id,
        progress.mission.reward_points,
        progress.mission.reward_exp
      );

      if (result.success) {
        alert(result.message);
        await loadMissions();
      } else {
        alert(result.message);
      }
    } finally {
      setClaimingId(null);
    }
  }

  async function handleClaimAll(claimableList: MissionProgress[]) {
    if (claimableList.length === 0 || claimingId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setClaimingId('bulk');
    try {
      let claimed = 0;
      for (const progress of claimableList) {
        const result = await claimMissionReward(
          user.id,
          progress.id,
          progress.mission.reward_points,
          progress.mission.reward_exp
        );
        if (result.success) claimed++;
      }
      if (claimed > 0) {
        alert(`${claimed}件の報酬を受け取りました！`);
        await loadMissions();
      }
    } finally {
      setClaimingId(null);
    }
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

  return (
    <div className="min-h-screen bg-black px-4 py-6">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-orange-500">📋 デイリーミッション</h1>
          <p className="text-gray-400 text-sm mt-1">毎日のミッションをクリアして報酬を獲得</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="text-xl font-bold text-orange-500">{currentPoints}pt</div>
            <div className="text-xs text-gray-400">現在のポイント</div>
          </div>
        </header>

        {/* 進捗サマリー */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">今日の進捗</h2>
            <div className="font-bold text-orange-500 text-sm">
              {completedCount} / {totalMissions} 完了
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-sm text-gray-400 mt-2 text-center">
            {progressPercent.toFixed(0)}% 完了
          </div>
          {(() => {
            const claimable = missions.filter(m => m.completed && !m.claimed);
            if (claimable.length === 0) return null;
            return (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => handleClaimAll(claimable)}
                  disabled={claimingId !== null}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
                >
                  {claimingId === 'bulk' ? '受け取り中...' : `🎁 完了分を一括受け取り（${claimable.length}件）`}
                </button>
              </div>
            );
          })()}
        </div>

        {/* その他メニュー */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/friends" className="rounded-2xl p-4 bg-white/5 border border-white/10 font-bold text-left active:scale-[0.98] transition">
            <span className="text-2xl block mb-1">👥</span>
            <span className="text-sm text-white">フレンド</span>
          </Link>
          <Link href="/ranking" className="rounded-2xl p-4 bg-white/5 border border-white/10 font-bold text-left active:scale-[0.98] transition">
            <span className="text-2xl block mb-1">🏆</span>
            <span className="text-sm text-white">ランキング</span>
          </Link>
          <Link href="/equipment" className="rounded-2xl p-4 bg-white/5 border border-white/10 font-bold text-left active:scale-[0.98] transition">
            <span className="text-2xl block mb-1">🛡️</span>
            <span className="text-sm text-white">装備</span>
          </Link>
          <Link href="/" className="rounded-2xl p-4 bg-white/5 border border-white/10 font-bold text-left active:scale-[0.98] transition">
            <span className="text-2xl block mb-1">🏠</span>
            <span className="text-sm text-white">ホーム</span>
          </Link>
        </div>

        {/* ミッション一覧 */}
        <div className="space-y-3 mb-6">
          {missions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
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
                  className={`rounded-2xl p-4 border backdrop-blur-sm ${
                    isCompleted
                      ? isClaimed
                        ? 'border-white/10 bg-white/5 opacity-75'
                        : 'border-orange-500/50 bg-orange-500/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="text-2xl flex-shrink-0">{getMissionIcon(mission.mission_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-white text-sm">{mission.title}</h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold border ${getDifficultyColor(
                              mission.difficulty
                            )}`}
                          >
                            {getDifficultyName(mission.difficulty)}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mb-2 line-clamp-2">{mission.description}</p>
                        <div className="space-y-1">
                          <div className="text-gray-400 text-xs">
                            進捗: <span className="font-bold text-orange-400">
                              {progress.current_count} / {mission.target_count}
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(progressPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isCompleted && !isClaimed ? (
                        <button
                          onClick={() => handleClaimReward(progress)}
                          disabled={claimingId !== null}
                          className="py-2 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {claimingId === progress.id ? '...' : '🎁'}
                        </button>
                      ) : isClaimed ? (
                        <div className="py-2 px-4 rounded-xl bg-white/5 text-gray-400 border border-white/10 text-sm font-bold">
                          ✓
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">未達成</div>
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

      </div>
    </div>
  );
}
