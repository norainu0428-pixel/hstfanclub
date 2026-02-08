'use client';
/**
 * パーティーモード（冒険モードとは別）
 * 実装内容: パーティーを編成して専用ステージに挑戦。冒険の1〜400ステージとは独立。
 * フレンドを誘って協力バトル可能。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';

interface FriendOption {
  friend_id: string;
  display_name: string;
}

export default function PartyPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [isOwner, setIsOwner] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
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

  async function loadFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: asUser } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted');
    const { data: asFriend } = await supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_id', user.id)
      .eq('status', 'accepted');
    const friendIds = [
      ...(asUser || []).map((f: { friend_id: string }) => f.friend_id),
      ...(asFriend || []).map((f: { user_id: string }) => f.user_id)
    ];
    const unique = [...new Set(friendIds)];
    if (unique.length === 0) {
      setFriends([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', unique);
    setFriends((profiles || []).map((p: { user_id: string; display_name: string }) => ({
      friend_id: p.user_id,
      display_name: p.display_name || '不明'
    })));
  }

  async function inviteFriend(friendId: string) {
    const filled = party.filter((m): m is Member => m !== null);
    if (filled.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    setInvitingFriendId(friendId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const hostPartyIds = filled.map(m => m.id);
    const { data: invite, error } = await supabase
      .from('adventure_invites')
      .insert({
        host_id: user.id,
        friend_id: friendId,
        host_party_ids: hostPartyIds,
        status: 'pending',
        invite_mode: 'party'
      })
      .select('id')
      .single();
    setInvitingFriendId(null);
    if (error) {
      if (error.code === '23505') {
        alert('このフレンドには既に招待を送っています');
      } else {
        alert('招待の送信に失敗しました: ' + error.message);
      }
      return;
    }
    setShowInviteModal(false);
    alert('招待を送りました！フレンドが参加したらステージを選べます。');
    router.push(`/party/stages?invite_id=${invite.id}`);
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
          <div className="flex gap-3">
            <button
              onClick={startParty}
              disabled={filledCount === 0}
              className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold text-xl disabled:opacity-50 hover:opacity-90"
            >
              ステージを選ぶ
            </button>
            <button
              onClick={async () => {
                setShowInviteModal(true);
                await loadFriends();
              }}
              disabled={filledCount === 0}
              className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold disabled:opacity-50 hover:opacity-90"
              title="フレンドを誘って協力バトル"
            >
              👥 誘う
            </button>
          </div>
        </div>

        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-4">フレンドを誘う</h3>
              {friends.length === 0 ? (
                <p className="text-gray-500 mb-4">フレンドがいません。フレンド申請を送ってから誘ってください。</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {friends.map((f) => (
                    <button
                      key={f.friend_id}
                      onClick={() => inviteFriend(f.friend_id)}
                      disabled={!!invitingFriendId}
                      className="w-full p-3 text-left border-2 border-gray-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition"
                    >
                      {f.display_name}
                      {invitingFriendId === f.friend_id && ' (送信中...)'}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

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

        <div className="mt-6 text-center flex flex-wrap justify-center gap-4">
          <button onClick={() => router.push('/party/invites')} className="text-white hover:underline">📬 パーティの招待を見る</button>
          <button onClick={() => router.push('/')} className="text-white hover:underline">← トップに戻る</button>
        </div>
      </div>
    </div>
  );
}
