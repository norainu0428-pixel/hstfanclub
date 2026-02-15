'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStageInfo, EXTRA_STAGE_START, EXTRA_STAGE_END, isExtraStage } from '@/utils/stageGenerator';

// ステージ100未クリアでもエクストラの1ステージ目(401)だけ解放する特別対応ユーザー
const EXTRA_STAGE_FIRST_UNLOCK_USER_ID = '7d2ffd6b-79fc-409e-afa1-24e69d0e6a04';

export default function StagesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const partyIds = searchParams.get('party') || '';
  const inviteId = searchParams.get('invite_id') || '';
  const currentStageParam = searchParams.get('current') || '1';
  const extraView = searchParams.get('extra') === '1';
  const parsedStage = parseInt(currentStageParam);
  // 通常ステージは 1–400、エクストラは 401–1000。401+ を 1 にしていたためエクストラが巻き戻って見えていたので修正
  const currentStage = extraView
    ? (isNaN(parsedStage) || parsedStage < EXTRA_STAGE_START ? EXTRA_STAGE_START : Math.min(EXTRA_STAGE_END, Math.max(EXTRA_STAGE_START, parsedStage)))
    : (isNaN(parsedStage) || parsedStage < 1 ? 1 : Math.min(400, parsedStage > 400 ? 400 : parsedStage));
  const [unlockedStages, setUnlockedStages] = useState<number[]>([]);
  const [clearedStages, setClearedStages] = useState<number[]>([]);
  const [canAccessExtraStages, setCanAccessExtraStages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  /** エクストラで次に挑戦すべきステージ（battle_logs から算出）。URL の current は通常のみで、エクストラはここを使う */
  const [nextExtraStage, setNextExtraStage] = useState<number | null>(null);
  const stagesPerPage = 100; // 1ページあたり100ステージ表示
  const extraStagesPerPage = 50; // エクストラは50ずつ

  useEffect(() => {
    loadUnlockedStages(extraView);
  }, [extraView]);

  async function loadUnlockedStages(extraViewParam: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 進行状況とクリア済みステージを並列で取得
    const [progressResult, clearedResult] = await Promise.all([
      supabase
        .from('user_progress')
        .select('current_stage')
        .eq('user_id', user.id)
        .maybeSingle(),
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

    // エクストラにアクセス可能か（100クリア または 特別対応ユーザー）
    const canExtra = cleared.has(100) || user.id === EXTRA_STAGE_FIRST_UNLOCK_USER_ID;
    setCanAccessExtraStages(canExtra);

    // 解放ステージ（通常）は user_progress.current_stage を基準にする
    const currentStageFromProgress = progressResult.data?.current_stage ?? 1;
    const nextUnlocked = Math.min(400, Math.max(1, currentStageFromProgress));
    const unlocked: number[] = [];
    for (let i = 1; i <= nextUnlocked; i++) {
      unlocked.push(i);
    }
    // エクストラ: 100クリア時 または 特別対応ユーザーは401だけ最初に解放し、以降は1ステージクリアで次を解放
    let nextExtra: number | null = null;
    if (canExtra) {
      let maxExtraConsecutive = EXTRA_STAGE_START - 1;
      for (let s = EXTRA_STAGE_START; s <= EXTRA_STAGE_END; s++) {
        if (!cleared.has(s)) break;
        maxExtraConsecutive = s;
      }
      nextExtra = Math.min(EXTRA_STAGE_END, maxExtraConsecutive + 1);
      for (let i = EXTRA_STAGE_START; i <= nextExtra; i++) {
        unlocked.push(i);
      }
      setNextExtraStage(nextExtra);
    } else {
      setNextExtraStage(null);
    }
    setUnlockedStages(unlocked);
    // エクストラ表示時は「次に挑戦するステージ」でページを決める（URL の current は 401 のままの人が多いため）
    const page = extraViewParam && nextExtra != null
      ? Math.ceil((nextExtra - EXTRA_STAGE_START + 1) / extraStagesPerPage) || 1
      : extraViewParam
        ? Math.ceil((currentStage - EXTRA_STAGE_START + 1) / extraStagesPerPage) || 1
        : Math.ceil(Math.min(currentStage, 400) / stagesPerPage) || 1;
    setCurrentPage(page);
  }

  function selectStage(stage: number) {
    if (!unlockedStages.includes(stage)) {
      alert(isExtraStage(stage) ? 'ステージ100をクリアするとエクストラステージに挑戦できます！先に401から順にクリアしてください。' : `ステージ${stage}はまだアンロックされていません！`);
      return;
    }
    const params = new URLSearchParams({ party: partyIds || '_' });
    if (inviteId) params.set('invite_id', inviteId);
    router.push(`/adventure/stage/${stage}?${params.toString()}`);
  }

  function goToExtraView() {
    const params = new URLSearchParams({ party: partyIds || '_', extra: '1' });
    if (inviteId) params.set('invite_id', inviteId);
    router.push(`/adventure/stages?${params.toString()}`);
  }
  function goToNormalView() {
    const params = new URLSearchParams({ party: partyIds || '_' });
    if (inviteId) params.set('invite_id', inviteId);
    router.push(`/adventure/stages?${params.toString()}`);
  }

  const totalNormalPages = Math.ceil(400 / stagesPerPage);
  const totalExtraPages = Math.ceil((EXTRA_STAGE_END - EXTRA_STAGE_START + 1) / extraStagesPerPage);
  const isExtraMode = extraView && canAccessExtraStages;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">{isExtraMode ? '⭐ エクストラステージ' : '🗺️ ステージ選択'}</h1>
          <p className="text-lg opacity-90">{isExtraMode ? `ステージ401〜1000（Lv1000まで楽しめる・武器ドロップ）` : '挑戦するステージを選んでください'}</p>
          {inviteId && <p className="text-cyan-300 mt-2">👥 協力バトルモード</p>}
        </div>

        {/* エクストラ案内 or 通常に戻る */}
        {canAccessExtraStages && (
          <div className="mb-4">
            {!isExtraMode ? (
              <button
                onClick={goToExtraView}
                className="w-full rounded-2xl p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-left flex items-center gap-3 shadow-lg"
              >
                <span className="text-3xl">💀</span>
                <div>
                  <div className="text-lg">エクストラステージ 401〜1000</div>
                  <div className="text-sm opacity-90">Lv80〜1000まで・全員最強スキル・武器ドロップあり</div>
                </div>
              </button>
            ) : (
              <button
                onClick={goToNormalView}
                className="w-full py-2 rounded-xl border-2 border-white/50 text-white font-bold"
              >
                ← 通常ステージ 1-400 に戻る
              </button>
            )}
          </div>
        )}

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
                ページ {currentPage} / {isExtraMode ? totalExtraPages : totalNormalPages}
              </div>
              <div className="text-sm text-gray-900">
                {isExtraMode
                  ? `ステージ ${EXTRA_STAGE_START + (currentPage - 1) * extraStagesPerPage} - ${Math.min(EXTRA_STAGE_START + currentPage * extraStagesPerPage - 1, EXTRA_STAGE_END)}`
                  : `ステージ ${(currentPage - 1) * stagesPerPage + 1} - ${Math.min(currentPage * stagesPerPage, 400)}`}
              </div>
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(isExtraMode ? totalExtraPages : totalNormalPages, prev + 1))}
              disabled={currentPage >= (isExtraMode ? totalExtraPages : totalNormalPages)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              次のページ →
            </button>
          </div>
        </div>

        {/* ステージグリッド */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <div className="grid grid-cols-10 gap-2">
            {Array.from({ length: isExtraMode ? extraStagesPerPage : stagesPerPage }, (_, i) => {
              const stage = isExtraMode
                ? EXTRA_STAGE_START + (currentPage - 1) * extraStagesPerPage + i
                : (currentPage - 1) * stagesPerPage + i + 1;
              if (isExtraMode && stage > EXTRA_STAGE_END) return null;
              if (!isExtraMode && stage > 400) return null;
              
              const stageInfo = getStageInfo(stage);
              const isUnlocked = unlockedStages.includes(stage);
              const isCleared = clearedStages.includes(stage);
              const isCurrent = isExtraMode ? stage === (nextExtraStage ?? currentStage) : stage === currentStage;
              const isBoss = !isExtraMode && stage % 10 === 0;
              const isMegaBoss = !isExtraMode && stage % 100 === 0;
              const isUltimateBoss = !isExtraMode && stage % 200 === 0;
              const isExtraBoss = isExtraMode && (stage - EXTRA_STAGE_START) % 10 === 9;

              return (
                <button
                  key={stage}
                  onClick={() => selectStage(stage)}
                  disabled={!isUnlocked}
                  className={`
                    relative p-3 rounded-lg font-bold text-sm transition
                    ${isExtraMode ? (isUnlocked ? (isCleared ? 'bg-gradient-to-br from-green-500 to-teal-500 text-white' : isExtraBoss ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white') : 'bg-gray-300 text-gray-900 cursor-not-allowed opacity-50')
                    : isUnlocked
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
                    {isExtraMode ? (isExtraBoss ? '💀' : stage) : (isUltimateBoss ? '💀👑' : isMegaBoss ? '👑🔥' : isBoss ? '👑' : stage)}
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
            {(() => {
              const detailStart = isExtraMode ? EXTRA_STAGE_START + (currentPage - 1) * extraStagesPerPage : currentStage;
              return [detailStart, detailStart + 1, detailStart + 2].map(stage => {
              if (!isExtraMode && stage > 400) return null;
              if (isExtraMode && stage > EXTRA_STAGE_END) return null;
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
                    {isExtraStage(stage) ? '⭐ ' : ''}ステージ {stage}
                    {!isExtraStage(stage) && stage % 200 === 0 && <span className="ml-2">💀👑</span>}
                    {!isExtraStage(stage) && stage % 100 === 0 && stage % 200 !== 0 && <span className="ml-2">👑🔥</span>}
                    {!isExtraStage(stage) && stage % 10 === 0 && stage % 100 !== 0 && <span className="ml-2">👑</span>}
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
            });
            })()}
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
