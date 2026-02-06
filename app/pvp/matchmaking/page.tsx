'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';

export default function MatchmakingPage() {
  const [party, setParty] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [friendName, setFriendName] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendId = searchParams.get('friend');
  const battleId = searchParams.get('battle');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // メンバー読み込み
    const { data: members } = await supabase
      .from('user_members')
      .select('*')
      .eq('user_id', user.id)
      .order('level', { ascending: false });

    setParty(members || []);

    // フレンド名取得
    if (friendId) {
      const { data: friendProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', friendId)
        .single();

      setFriendName(friendProfile?.display_name || '不明');
    }

    setLoading(false);
  }

  function toggleMember(member: Member) {
    if (selectedMembers.find(m => m.id === member.id)) {
      setSelectedMembers(selectedMembers.filter(m => m.id !== member.id));
    } else if (selectedMembers.length < 3) {
      setSelectedMembers([...selectedMembers, member]);
    }
  }

  async function startBattle() {
    if (selectedMembers.length === 0) {
      alert('最低1体のメンバーを選択してください');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 初期HPを設定
    const initialHp: { [key: string]: number } = {};
    selectedMembers.forEach(member => {
      initialHp[member.id] = member.max_hp;
    });

    // 既存のバトルに参加する場合
    if (battleId) {
      const { error } = await supabase
        .from('pvp_battles')
        .update({
          player2_party: selectedMembers.map(m => m.id),
          player2_hp: initialHp,
          status: 'in_progress',
          battle_log: [...(await getCurrentBattleLog()), 'バトル開始！']
        })
        .eq('id', battleId);

      if (error) {
        alert('バトルへの参加に失敗しました');
        console.error(error);
        return;
      }

      router.push(`/pvp/battle/${battleId}`);
      return;
    }

    // 新しいバトルルーム作成
    const { data: battle, error } = await supabase
      .from('pvp_battles')
      .insert({
        player1_id: user.id,
        player2_id: friendId,
        player1_party: selectedMembers.map(m => m.id),
        player1_hp: initialHp,
        status: 'waiting',
        current_turn_player: user.id,
        battle_log: [`${friendName}との対戦が開始されました！`]
      })
      .select()
      .single();

    if (error || !battle) {
      alert('バトルルームの作成に失敗しました');
      console.error(error);
      return;
    }

    router.push(`/pvp/battle/${battle.id}`);
  }

  async function getCurrentBattleLog(): Promise<string[]> {
    if (!battleId) return [];
    const { data } = await supabase
      .from('pvp_battles')
      .select('battle_log')
      .eq('id', battleId)
      .single();
    return data?.battle_log || [];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">⚔️ PvP対戦</h1>
          <p className="text-lg opacity-90">対戦相手: {friendName}</p>
        </div>

        {/* パーティ選択 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">パーティを選択（最大3体）</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[0, 1, 2].map(index => (
              <div
                key={index}
                className="border-4 border-dashed border-gray-300 rounded-xl p-4 min-h-[200px] flex items-center justify-center"
              >
                {selectedMembers[index] ? (
                  <div className="text-center">
                    <div className="text-4xl mb-2">{selectedMembers[index].member_emoji}</div>
                    <div className="font-bold">{selectedMembers[index].member_name}</div>
                    <div className="text-sm text-gray-500">Lv.{selectedMembers[index].level}</div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-center">
                    <div className="text-4xl mb-2">➕</div>
                    <div className="text-sm">メンバーを選択</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={startBattle}
            disabled={selectedMembers.length === 0}
            className={`w-full bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg transition ${
              selectedMembers.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-105'
            }`}
          >
            対戦開始！
          </button>
        </div>

        {/* メンバー一覧 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4">所持メンバー</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {party.map(member => (
              <div
                key={member.id}
                onClick={() => toggleMember(member)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedMembers.find(m => m.id === member.id)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">{member.member_emoji}</div>
                  <div className="font-bold text-sm">{member.member_name}</div>
                  <div className="text-xs text-gray-500">Lv.{member.level}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/friends')}
            className="bg-white text-red-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
