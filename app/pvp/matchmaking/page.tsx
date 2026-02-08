'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';

interface PendingInvite {
  id: string;
  challenger_name: string;
  challenger_id: string;
  created_at: string;
}

export default function MatchmakingPage() {
  const [party, setParty] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [friendName, setFriendName] = useState('');
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const friendId = searchParams.get('friend');
  const battleId = searchParams.get('battle');

  useEffect(() => {
    loadData();
  }, [friendId, battleId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

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
        .maybeSingle();
      setFriendName(friendProfile?.display_name || '不明');
    }

    // 自分への対戦招待（status=waiting かつ player2_id=自分）を取得
    const { data: invites } = await supabase
      .from('pvp_battles')
      .select('id, player1_id, created_at')
      .eq('player2_id', user.id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(5);

    if (invites && invites.length > 0) {
      const challengerIds = [...new Set(invites.map(i => i.player1_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', challengerIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name || '不明']));
      setPendingInvites(invites.map(inv => ({
        id: inv.id,
        challenger_name: nameMap.get(inv.player1_id) || '不明',
        challenger_id: inv.player1_id,
        created_at: inv.created_at
      })));
    } else {
      setPendingInvites([]);
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
    const { data, error } = await supabase
      .from('pvp_battles')
      .select('battle_log')
      .eq('id', battleId)
      .maybeSingle();
    
    if (error) {
      console.error('バトルログ取得エラー:', error);
      return [];
    }
    
    return data?.battle_log || [];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  // フレンド未選択かつ招待もない場合
  if (!friendId && !battleId && pendingInvites.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-2">⚔️ PvP対戦</h1>
            <p className="text-lg opacity-90">フレンドを選択して対戦を開始しましょう</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-6">👥</div>
            <p className="text-gray-900 mb-6">対戦するにはフレンドが必要です。フレンド一覧から対戦したい相手を選んでください。</p>
            <button
              onClick={() => router.push('/friends')}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white px-8 py-4 rounded-full text-xl font-bold shadow-lg hover:opacity-90"
            >
              フレンド一覧へ
            </button>
          </div>
          <div className="text-center mt-8">
            <button onClick={() => router.push('/games')} className="text-white/80 hover:text-white">
              ← ゲームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 招待のみ（フレンド未選択だが招待がある）
  if (!friendId && !battleId && pendingInvites.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-2">⚔️ 対戦招待</h1>
            <p className="text-lg opacity-90">あなたへの対戦招待</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
            <div className="space-y-3">
              {pendingInvites.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-orange-400 transition"
                >
                  <div>
                    <div className="font-bold text-lg">{inv.challenger_name} が対戦を申し込みました</div>
                    <div className="text-sm text-gray-900">
                      {new Date(inv.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/pvp/matchmaking?friend=${inv.challenger_id}&battle=${inv.id}`)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600"
                  >
                    受ける
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <button
              onClick={() => router.push('/friends')}
              className="text-white/80 hover:text-white"
            >
              フレンドを選んで挑戦する →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">⚔️ PvP対戦</h1>
          <p className="text-lg opacity-90">対戦相手: {friendName || '招待中'}</p>
          {pendingInvites.length > 0 && (
            <p className="text-sm mt-2">
              <button
                onClick={() => router.push('/pvp/matchmaking')}
                className="underline hover:no-underline"
              >
                あなたへの対戦招待が{pendingInvites.length}件あります
              </button>
            </p>
          )}
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
                    <div className="text-sm text-gray-900">Lv.{selectedMembers[index].level}</div>
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
                  <div className="text-xs text-gray-900">Lv.{member.level}</div>
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
