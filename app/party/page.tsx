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
    router.push(`/party/lobby?invite_id=${invite.id}`);
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
          <p className="text-sm text-white/70 mt-1">フレンドを招待してロビーで待ち、一緒に戦闘開始！</p>
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-6 max-w-md w-full shadow-2xl border-4 border-cyan-400">
              <h3 className="text-2xl font-bold mb-2 text-center text-gray-800">👥 フレンドを誘う</h3>
              <p className="text-sm text-gray-600 text-center mb-4">招待するフレンドを選んでください</p>
              {friends.length === 0 ? (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
                  <p className="text-amber-800 font-bold">フレンドがいません</p>
                  <p className="text-amber-700 text-sm mt-1">フレンド申請を送ってから誘ってください。</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                  {friends.map((f) => (
                    <button
                      key={f.friend_id}
                      onClick={() => inviteFriend(f.friend_id)}
                      disabled={!!invitingFriendId}
                      className="w-full p-4 text-left bg-white border-2 border-cyan-300 rounded-xl hover:border-cyan-500 hover:bg-cyan-100 hover:shadow-lg transition-all flex items-center gap-3 font-bold text-gray-800"
                    >
                      <span className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white text-lg">
                        {(f.display_name || '?').charAt(0)}
                      </span>
                      <span className="flex-1 truncate">{f.display_name || '名前なし'}</span>
                      {invitingFriendId === f.friend_id ? (
                        <span className="text-cyan-600 text-sm animate-pulse">送信中...</span>
                      ) : (
                        <span className="text-cyan-600 text-sm">→ 招待</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-800 transition"
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
