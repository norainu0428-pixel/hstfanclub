'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import { LEVEL_TRAINING_STAGES } from '@/utils/stageGenerator';
import MemberCard from '@/components/adventure/MemberCard';

const DAILY_LIMIT = 5;

export default function LevelTrainingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [remaining, setRemaining] = useState<number>(DAILY_LIMIT);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: membersData, error: membersError } = await supabase
      .from('user_members')
      .select('*')
      .eq('user_id', user.id)
      .order('level', { ascending: false });

    if (membersError) {
      console.error('メンバー取得エラー:', membersError);
      setLoading(false);
      return;
    }

    setMembers(membersData || []);

    // 今日のレベルアップステージ挑戦回数をカウント
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { count } = await supabase
      .from('battle_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('stage', LEVEL_TRAINING_STAGES as unknown as number[])
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    setRemaining(Math.max(0, DAILY_LIMIT - (count || 0)));
    setLoading(false);
  }

  function toggleParty(member: Member) {
    if (party.some(m => m?.id === member.id)) {
      setParty(party.map(m => (m?.id === member.id ? null : m)));
      return;
    }
    const emptyIndex = party.findIndex(m => m === null);
    if (emptyIndex !== -1) {
      const next = [...party];
      next[emptyIndex] = member;
      setParty(next);
    }
  }

  function startTraining(stageId: number) {
    const filled = party.filter(m => m !== null) as Member[];
    if (filled.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    if (remaining <= 0) {
      alert(`レベルアップステージは1日${DAILY_LIMIT}回までです。また明日お試しください。`);
      return;
    }

    const partyIds = filled.map(m => m.id).join(',');
    router.push(`/adventure/stage/${stageId}?party=${partyIds}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  const maxLevel = members.reduce((max, m) => Math.max(max, m.level), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">📘 レベルアップステージ</h1>
          <p className="text-lg opacity-90 mb-2">
            1日 {DAILY_LIMIT} 回まで挑戦できます（今日はあと <span className="font-bold">{remaining}</span> 回）。
          </p>
          <p className="text-sm opacity-80">
            あなたの最高レベル: Lv.{maxLevel || 1}
          </p>
        </div>

        {/* ステージ選択 */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <h2 className="text-xl font-bold mb-2 text-gray-900">初級</h2>
            <p className="text-sm text-gray-700 mb-3">Lv1〜50向け。安全に経験値を稼げるステージです。</p>
            <p className="text-xs text-gray-500 mb-4">ステージID: {LEVEL_TRAINING_STAGES[0]}</p>
            <button
              onClick={() => startTraining(LEVEL_TRAINING_STAGES[0])}
              className="w-full py-2 rounded-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={remaining <= 0}
            >
              初級でレベル上げ
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <h2 className="text-xl font-bold mb-2 text-gray-900">中級</h2>
            <p className="text-sm text-gray-700 mb-3">Lv1〜100向け。そこそこ強い敵で効率よく経験値獲得。</p>
            <p className="text-xs text-gray-500 mb-4">ステージID: {LEVEL_TRAINING_STAGES[1]}</p>
            <button
              onClick={() => startTraining(LEVEL_TRAINING_STAGES[1])}
              className="w-full py-2 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={remaining <= 0}
            >
              中級でレベル上げ
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <h2 className="text-xl font-bold mb-2 text-gray-900">上級</h2>
            <p className="text-sm text-gray-700 mb-3">Lv200〜300向け。かなり強敵だが大量の経験値が入ります。</p>
            <p className="text-xs text-gray-500 mb-4">ステージID: {LEVEL_TRAINING_STAGES[2]}</p>
            <button
              onClick={() => startTraining(LEVEL_TRAINING_STAGES[2])}
              className="w-full py-2 rounded-lg font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={remaining <= 0}
            >
              上級でレベル上げ
            </button>
          </div>
        </div>

        {/* パーティ編成 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">パーティ編成（最大3体）</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {party.map((m, idx) => (
              <div
                key={idx}
                className="h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50"
              >
                {m ? (
                  <div className="text-center">
                    <div className="text-3xl mb-1">{m.member_emoji}</div>
                    <div className="text-sm font-bold text-gray-900">{m.member_name}</div>
                    <div className="text-xs text-gray-600">Lv.{m.level}</div>
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">メンバーを選択</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            下の所持メンバー一覧からタップしてパーティに追加・削除できます。
          </p>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-gray-900/80 border border-orange-500/40 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4 text-white">所持メンバー ({members.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(member => {
              const selected = party.some(m => m?.id === member.id);
              return (
                <div
                  key={member.id}
                  className={`cursor-pointer ${selected ? 'ring-4 ring-emerald-400 rounded-2xl' : ''}`}
                  onClick={() => toggleParty(member)}
                >
                  <MemberCard member={member} showStats={true} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

