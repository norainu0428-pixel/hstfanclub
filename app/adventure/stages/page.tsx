'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStageInfo } from '@/utils/stageGenerator';

export default function StagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const partyIds = searchParams.get('party') || '';
  const inviteId = searchParams.get('invite_id') || '';
  const currentStageParam = searchParams.get('current') || '1';
  const parsedStage = parseInt(currentStageParam);
  
  const currentStage = (isNaN(parsedStage) || parsedStage < 1 || parsedStage > 400) ? 1 : parsedStage;
  const [unlockedStages, setUnlockedStages] = useState<number[]>([]);
  const [clearedStages, setClearedStages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const stagesPerPage = 100; // 1ページあたり100ステージ表示

  useEffect(() => {
    loadUnlockedStages();
  }, []);

  async function loadUnlockedStages() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 進行状況とクリア済みステージを並列で取得
    const [progressResult, clearedResult] = await Promise.all([
      supabase
        .from('user_progress')
        .select('current_stage')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('battle_logs')
        .select('stage')
        .eq('user_id', user.id)
        .eq('result', 'victory')
    ]);

    // クリア済みステージを取得
    const cleared = new Set<number>();
    if (clearedResult.data) {
      clearedResult.data.forEach(log => {
        cleared.add(log.stage);
      });
    }
    setClearedStages(Array.from(cleared));

    // 解放ステージ: 1から連続してクリアした最大番号+1まで（クリアしてないと次は解放されない）
    let maxConsecutive = 0;
    for (let s = 1; s <= 400; s++) {
      if (!cleared.has(s)) break;
      maxConsecutive = s;
    }
    const nextUnlocked = Math.min(400, maxConsecutive + 1);
    const unlocked: number[] = [];
    for (let i = 1; i <= nextUnlocked; i++) {
      unlocked.push(i);
    }
    setUnlockedStages(unlocked);
    
    // 現在のステージに応じてページを設定
    const page = Math.ceil(currentStage / stagesPerPage);
    setCurrentPage(page);
  }

  function selectStage(stage: number) {
    if (!unlockedStages.includes(stage)) {
      alert(`ステージ${stage}はまだアンロックされていません！`);
      return;
    }
    const params = new URLSearchParams({ party: partyIds || '_' });
    if (inviteId) params.set('invite_id', inviteId);
    router.push(`/adventure/stage/${stage}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🗺️ ステージ選択</h1>
          <p className="text-lg opacity-90">挑戦するステージを選んでください</p>
          {inviteId && <p className="text-cyan-300 mt-2">👥 協力バトルモード</p>}
        </div>

        {/* ページネーション */}
        <div className="bg-white rounded-2xl p-4 shadow-xl mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              ← 前のページ
            </button>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-700">
                ページ {currentPage} / {Math.ceil(400 / stagesPerPage)}
              </div>
              <div className="text-sm text-gray-900">
                ステージ {(currentPage - 1) * stagesPerPage + 1} - {Math.min(currentPage * stagesPerPage, 400)}
              </div>
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(400 / stagesPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(400 / stagesPerPage)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              次のページ →
            </button>
          </div>
        </div>

        {/* ステージグリッド */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: stagesPerPage }, (_, i) => {
              const stage = (currentPage - 1) * stagesPerPage + i + 1;
              if (stage > 400) return null;
              
              const stageInfo = getStageInfo(stage);
              const isUnlocked = unlockedStages.includes(stage);
              const isCleared = clearedStages.includes(stage);
              const isCurrent = stage === currentStage;
              const isBoss = stage % 10 === 0;
              const isMegaBoss = stage % 100 === 0;
              const isUltimateBoss = stage % 200 === 0;

              return (
                <button
                  key={stage}
                  onClick={() => selectStage(stage)}
                  disabled={!isUnlocked}
                  className={`
                    relative p-3 rounded-lg font-bold text-sm transition
                    ${isUnlocked
                      ? isCurrent
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg scale-105'
                        : isCleared
                        ? isUltimateBoss
                          ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white hover:scale-105 ring-4 ring-green-400'
                          : isMegaBoss
                          ? 'bg-gradient-to-br from-green-500 to-teal-500 text-white hover:scale-105 ring-2 ring-green-400'
                          : isBoss
                          ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white hover:scale-105'
                          : 'bg-gradient-to-br from-green-300 to-emerald-400 text-white hover:scale-105'
                        : isUltimateBoss
                        ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white hover:scale-105 ring-4 ring-purple-400'
                        : isMegaBoss
                        ? 'bg-gradient-to-br from-red-600 to-orange-600 text-white hover:scale-105 ring-2 ring-red-400'
                        : isBoss
                        ? 'bg-gradient-to-br from-red-500 to-pink-500 text-white hover:scale-105'
                        : 'bg-gradient-to-br from-blue-400 to-purple-500 text-white hover:scale-105'
                      : 'bg-gray-300 text-gray-900 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  <div className="text-lg">
                    {isUltimateBoss ? '💀👑' : isMegaBoss ? '👑🔥' : isBoss ? '👑' : stage}
                  </div>
                  {isCleared && (
                    <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-5 h-5 border-2 border-white flex items-center justify-center">
                      <span className="text-xs">✓</span>
                    </div>
                  )}
                  {isCurrent && !isCleared && (
                    <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full w-4 h-4 border-2 border-white"></div>
                  )}
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs">🔒</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ステージ詳細表示 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="text-2xl font-bold mb-4 text-center">ステージ情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[currentStage, currentStage + 1, currentStage + 2].map(stage => {
              if (stage > 400) return null;
              const stageInfo = getStageInfo(stage);
              const isUnlocked = unlockedStages.includes(stage);
              
              return (
                <div
                  key={stage}
                  className={`border-2 rounded-lg p-4 ${
                    isUnlocked ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-100 opacity-50'
                  }`}
                >
                  <div className="font-bold text-lg mb-2">
                    ステージ {stage}
                    {stage % 200 === 0 && <span className="ml-2">💀👑</span>}
                    {stage % 100 === 0 && stage % 200 !== 0 && <span className="ml-2">👑🔥</span>}
                    {stage % 10 === 0 && stage % 100 !== 0 && <span className="ml-2">👑</span>}
                  </div>
                  <div className="text-sm space-y-1">
                    <div>推奨レベル: <span className="font-bold">{stageInfo.recommendedLevel}</span></div>
                    <div>敵の数: <span className="font-bold">{stageInfo.enemies.length}体</span></div>
                    <div className="text-xs text-gray-900 mt-2">
                      {stageInfo.enemies.slice(0, 2).map(e => e.emoji).join(' ')}
                      {stageInfo.enemies.length > 2 && ' ...'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center">
          <button
            onClick={() => router.push('/adventure')}
            className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            パーティ編成に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
