'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';
import {
  getStageInfo,
  getExpStageId,
  EXP_STAGE_DAILY_LIMIT,
  type ExpStageDifficulty
} from '@/utils/stageGenerator';

const DIFFICULTY_LABELS: Record<ExpStageDifficulty, { label: string; emoji: string; desc: string }> = {
  easy: { label: 'イージー', emoji: '🟢', desc: '初級者向け・経験値600' },
  normal: { label: 'ノーマル', emoji: '🟡', desc: '中級者向け・経験値1800' },
  hard: { label: 'ハード', emoji: '🔴', desc: '上級者向け・経験値4000' }
};

export default function ExpStagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [todayClears, setTodayClears] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState<ExpStageDifficulty>('normal');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const [membersResult, clearsResult] = await Promise.all([
      supabase
        .from('user_members')
        .select('*')
        .eq('user_id', user.id)
        .order('level', { ascending: false }),
      supabase
        .from('exp_stage_clears')
        .select('clear_count')
        .eq('user_id', user.id)
        .eq('clear_date', today)
        .maybeSingle()
    ]);

    if (membersResult.data) {
      setMembers(membersResult.data);
    }

    if (clearsResult.data) {
      setTodayClears(clearsResult.data.clear_count || 0);
    }

    setLoading(false);
  }

  function addToParty(member: Member) {
    if (party.some(m => m?.id === member.id)) {
      setParty(party.map(m => m?.id === member.id ? null : m));
      return;
    }
    const emptyIndex = party.findIndex(m => m === null);
    if (emptyIndex !== -1) {
      const newParty = [...party];
      newParty[emptyIndex] = member;
      setParty(newParty);
    }
  }

  function startExpStage() {
    const filledParty = party.filter(m => m !== null);
    if (filledParty.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }

    const remaining = EXP_STAGE_DAILY_LIMIT - todayClears;
    if (remaining <= 0) {
      alert('本日の経験値アップステージは5回までです。明日また挑戦してください！');
      return;
    }

    const stageId = getExpStageId(selectedDifficulty);
    const partyIds = filledParty.map(m => m?.id).filter(Boolean).join(',');
    router.push(`/adventure/battle?stage=${stageId}&party=${partyIds}`);
  }

  const remaining = EXP_STAGE_DAILY_LIMIT - todayClears;
  const stageInfo = getStageInfo(getExpStageId(selectedDifficulty));
  const totalExp = stageInfo.enemies.reduce((s, e) => s + e.experience_reward, 0);
  const totalPoints = stageInfo.enemies.reduce((s, e) => s + e.points_reward, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">メンバーがいません</h1>
          <p className="text-gray-600 mb-6">まずはガチャでメンバーを獲得しましょう！</p>
          <button
            onClick={() => router.push('/adventure')}
            className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-700"
          >
            冒険に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">📚 経験値アップステージ</h1>
          <p className="text-lg opacity-90 mb-4">難易度を選んで効率的にレベルアップ！</p>
          <div className="bg-white/20 rounded-xl px-6 py-4 inline-block">
            <div className="text-2xl font-bold">
              本日の残り: <span className="text-yellow-300">{remaining}</span> / {EXP_STAGE_DAILY_LIMIT} 回
            </div>
            <div className="text-sm opacity-90 mt-1">毎日0時にリセット</div>
          </div>
        </div>

        {/* 難易度選択 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 text-center">難易度を選択</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['easy', 'normal', 'hard'] as const).map(diff => {
              const info = DIFFICULTY_LABELS[diff];
              const stage = getStageInfo(getExpStageId(diff));
              const exp = stage.enemies.reduce((s, e) => s + e.experience_reward, 0);
              const pts = stage.enemies.reduce((s, e) => s + e.points_reward, 0);
              const isSelected = selectedDifficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`p-4 rounded-xl border-2 transition text-left ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{info.emoji} {info.label}</div>
                  <div className="text-sm text-gray-600 mb-2">{info.desc}</div>
                  <div className="text-sm font-semibold">
                    推奨Lv.{stage.recommendedLevel} | 経験値 {exp} | ポイント {pts}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* パーティ編成 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 text-center">パーティ編成</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {party.map((member, index) => (
              <div
                key={index}
                className="border-2 border-dashed border-emerald-300 rounded-xl p-4 min-h-[200px] flex items-center justify-center bg-emerald-50/50"
              >
                {member ? (
                  <MemberCard
                    member={member}
                    onClick={() => addToParty(member)}
                    selected={true}
                    showStats={false}
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <div className="text-3xl mb-1">➕</div>
                    <div className="text-sm">メンバーを選択</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4 p-4 bg-gray-100 rounded-lg text-sm text-gray-700">
            <strong>報酬:</strong> 経験値 {totalExp} / ポイント {totalPoints}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={startExpStage}
              disabled={remaining <= 0 || party.filter(m => m !== null).length === 0}
              className={`px-12 py-4 rounded-xl text-xl font-bold transition ${
                remaining > 0 && party.filter(m => m !== null).length > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              ⚔️ 戦闘開始！
            </button>
            <button
              onClick={() => router.push('/adventure')}
              className="bg-gray-200 text-gray-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-300"
            >
              戻る
            </button>
          </div>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-gray-900">所持メンバー ({members.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => addToParty(member)}
                selected={party.some(m => m?.id === member.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
