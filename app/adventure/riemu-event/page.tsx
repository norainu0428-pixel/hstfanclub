'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Member, isMemberVisibleToUser } from '@/types/adventure';
import { RIEMU_EVENT_STAGES, getStageInfo } from '@/utils/stageGenerator';
import { getRarityMediumLabel } from '@/utils/rarity';

export default function RiemuEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [clearedStages, setClearedStages] = useState<number[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const [membersResult, profileResult] = await Promise.all([
      supabase.from('user_members').select('*').eq('user_id', user.id).order('level', { ascending: false }),
      supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
    ]);
    const { data: membersData } = membersResult;
    const isOwnerRole = profileResult.data?.role === 'owner';
    setIsOwner(isOwnerRole);
    let membersList = ((membersData || []) as Member[]).filter(m => isMemberVisibleToUser(m.member_name, isOwnerRole));
    setMembers(membersList);

    const { data: clears } = await supabase
      .from('riemu_event_clears')
      .select('stage')
      .eq('user_id', user.id);
    const clearedList = (clears || []).map(c => c.stage);
    setClearedStages(clearedList);

    // 復旧: 3006クリア済みなのに HST riemu がいない場合に付与する
    if (clearedList.includes(3006)) {
      const hasHstRiemu = membersList.some(m => m.member_name === 'HST riemu' && m.rarity === 'HST');
      if (!hasHstRiemu) {
        const { error: fixErr } = await supabase.from('user_members').insert({
          user_id: user.id,
          member_name: 'HST riemu',
          member_emoji: '🌟',
          member_description: 'HST Riemu イベント報酬',
          rarity: 'HST',
          level: 1,
          experience: 0,
          hp: 300,
          max_hp: 300,
          current_hp: 300,
          attack: 100,
          defense: 50,
          speed: 60,
          skill_type: 'riemu_blessing',
          skill_power: 0,
          revive_used: false,
        });
        if (!fixErr) {
          const { data: newMembers } = await supabase
            .from('user_members')
            .select('*')
            .eq('user_id', user.id)
            .order('level', { ascending: false });
          setMembers(((newMembers || []) as Member[]).filter(m => isMemberVisibleToUser(m.member_name, isOwnerRole)));
        }
      }
    }

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

  function startStage(stageId: number) {
    const filled = party.filter(m => m !== null) as Member[];
    if (filled.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    if (clearedStages.includes(stageId)) {
      alert('この HST Riemu イベントステージはすでにクリア済みです。');
      return;
    }
    const partyIds = filled.map(m => m.id).join(',');
    router.push(`/adventure/stage/${stageId}?party=${partyIds}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-600 to-red-600 flex items-center justify-center">
        <p className="text-white text-xl">イベントステージを準備中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-600 to-red-600 p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">✨ HST Riemu イベントステージ</h1>
        <p className="text-white/80 mb-6 text-sm">
          Riemuに挑戦して、レアリティ別の Riemu / HST Riemu をゲットしよう！各ステージは一度クリアすると再挑戦できません。
        </p>

        {/* パーティ編成 */}
        <div className="bg-black/40 rounded-2xl p-4 mb-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-3">パーティ編成</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {party.map((member, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-black/30 h-28 flex items-center justify-center">
                {member ? (
                  <button
                    onClick={() => toggleParty(member)}
                    className="text-center text-white"
                  >
                    <div className="text-3xl mb-1">{member.member_emoji}</div>
                    <div className="text-sm font-bold">{member.member_name}</div>
                    <div className="text-xs text-white/70">Lv.{member.level}</div>
                  </button>
                ) : (
                  <span className="text-white/40 text-sm">メンバーを選択</span>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 mt-3">
            <h3 className="text-sm font-bold text-white mb-2">所持メンバー</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
              {members.map(m => {
                const selected = party.some(p => p?.id === m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleParty(m)}
                    className={`text-left rounded-lg p-2 text-xs border ${
                      selected ? 'bg-orange-500/80 border-orange-300 text-white' : 'bg-black/30 border-white/10 text-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{m.member_emoji}</span>
                      <div>
                        <div className="font-bold">{m.member_name}</div>
                        <div className="text-[10px] text-white/70">Lv.{m.level}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* イベントステージ一覧 */}
        <div className="bg-black/40 rounded-2xl p-4 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-3">ステージ一覧</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {RIEMU_EVENT_STAGES.map(stageId => {
              const { recommendedLevel } = getStageInfo(stageId);
              const cleared = clearedStages.includes(stageId);
              const rewardRarity =
                stageId === 3001 ? 'common' :
                stageId === 3002 ? 'rare' :
                stageId === 3003 ? 'super-rare' :
                stageId === 3004 ? 'ultra-rare' :
                stageId === 3005 ? 'legendary' : 'HST';

              return (
                <button
                  key={stageId}
                  onClick={() => startStage(stageId)}
                  disabled={cleared}
                  className={`rounded-xl p-4 text-left border transition ${
                    cleared
                      ? 'bg-gray-600/70 text-gray-200 border-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-br from-pink-500 to-red-500 text-white border-white/20 hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">
                      {stageId === 3006 ? 'HST riemu 決戦' : `riemu ステージ ${stageId - 3000}`}
                    </div>
                    <span className="text-xl">🌟</span>
                  </div>
                  <div className="text-xs mb-1">推奨Lv.{recommendedLevel}</div>
                  <div className="text-xs mb-1">
                    報酬: {getRarityMediumLabel(rewardRarity)}
                  </div>
                  {cleared && <div className="text-[11px] text-green-300 mt-1">クリア済み</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 rounded-xl bg-white/10 text-white text-sm border border-white/20"
          >
            ← ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

