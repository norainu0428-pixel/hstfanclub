'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Member, isMemberVisibleToUser } from '@/types/adventure';
import { TOWER_STAGE_START, TOWER_STAGE_END, getStageInfo } from '@/utils/stageGenerator';

export default function TowerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [clearedFloors, setClearedFloors] = useState<number[]>([]);
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
    setMembers(((membersData || []) as Member[]).filter(m => isMemberVisibleToUser(m.member_name, isOwnerRole)));

    // クリア済みの塔階層を取得（永続）
    const { data: clears } = await supabase
      .from('tower_clears')
      .select('floor')
      .eq('user_id', user.id);
    setClearedFloors((clears || []).map(c => c.floor));

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

  function startFloor(floor: number) {
    const filled = party.filter(m => m !== null) as Member[];
    if (filled.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    if (clearedFloors.includes(floor)) {
      alert(`覇者の塔 第${floor}階はすでにクリア済みです。再挑戦はできません。`);
      return;
    }
    const partyIds = filled.map(m => m.id).join(',');
    const stageId = TOWER_STAGE_START + (floor - 1);
    router.push(`/adventure/stage/${stageId}?party=${partyIds}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-700 to-purple-800 flex items-center justify-center">
        <p className="text-white text-xl">覇者の塔を準備中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 to-purple-800 p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">🏯 覇者の塔</h1>
        <p className="text-white/80 mb-6 text-sm">
          強力なパーティを編成して、1階から100階までの塔を制覇しよう！各階は1回だけクリアできます。
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

        {/* 階層一覧 */}
        <div className="bg-black/40 rounded-2xl p-4 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-3">階層一覧（1〜100階）</h2>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: TOWER_STAGE_END - TOWER_STAGE_START + 1 }, (_, i) => {
              const floor = i + 1;
              const stageId = TOWER_STAGE_START + i;
              const { recommendedLevel } = getStageInfo(stageId);
              const cleared = clearedFloors.includes(floor);
              return (
                <button
                  key={floor}
                  onClick={() => startFloor(floor)}
                  disabled={cleared}
                  className={`rounded-lg px-2 py-2 text-xs font-bold border transition ${
                    cleared
                      ? 'bg-gray-600/70 text-gray-300 border-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-br from-red-500 to-purple-500 text-white border-white/20 hover:scale-105'
                  }`}
                >
                  <div className="text-sm">第{floor}階</div>
                  <div className="text-[10px] text-white/80">推奨Lv.{recommendedLevel}</div>
                  {cleared && <div className="text-[9px] text-green-300 mt-1">今週クリア済</div>}
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

