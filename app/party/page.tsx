'use client';
/**
 * パーティーモード（冒険モードとは別）
 * 実装内容: パーティーを編成して専用ステージに挑戦。冒険の1〜400ステージとは独立。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';

export default function PartyPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [isOwner, setIsOwner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const [profileResult, membersResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_members').select('*').eq('user_id', user.id).order('level', { ascending: false })
    ]);

    setIsOwner(profileResult.data?.role === 'owner');
    const membersData = membersResult.data || [];
    const filtered = profileResult.data?.role === 'owner'
      ? membersData
      : membersData.filter((m: Member) => m.rarity !== 'HST');
    setMembers(filtered);
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

  function startParty() {
    const filled = party.filter((m): m is Member => m !== null);
    if (filled.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    const ids = filled.map(m => m.id).join(',');
    router.push(`/party/stages?party=${ids}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
        <p className="text-white text-xl">読み込み中...</p>
      </div>
    );
  }

  const filledCount = party.filter(m => m !== null).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-6">
          <h1 className="text-4xl font-bold mb-2">🎭 パーティーモード</h1>
          <p className="text-lg opacity-90">冒険とは別の専用ステージに挑戦しよう</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="text-xl font-bold mb-4">パーティー編成 ({filledCount}/3)</h2>
          <div className="flex gap-4 mb-6 border-2 border-dashed border-gray-300 rounded-xl p-4 min-h-[120px]">
            {party.map((m, i) => (
              <div key={i} className="flex-1 min-w-0">
                {m ? (
                  <div onClick={() => addToParty(m)} className="cursor-pointer">
                    <MemberCard member={m} showStats={true} />
                    <p className="text-center text-xs text-gray-500 mt-1">クリックで外す</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                    空きスロット
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={startParty}
            disabled={filledCount === 0}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold text-xl disabled:opacity-50 hover:opacity-90"
          >
            ステージを選ぶ
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4">所持メンバー</h2>
          <div className="flex flex-wrap gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                onClick={() => addToParty(m)}
                className={`cursor-pointer ${party.some(p => p?.id === m.id) ? 'ring-4 ring-cyan-500 rounded-lg' : ''}`}
              >
                <MemberCard member={m} showStats={true} />
              </div>
            ))}
          </div>
          {members.length === 0 && <p className="text-gray-500">メンバーがいません。ガチャでメンバーを増やしましょう。</p>}
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => router.push('/')} className="text-white hover:underline">← トップに戻る</button>
        </div>
      </div>
    </div>
  );
}
