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
    <div className="min-h-screen bg-gradient-to-br from-cyan-900/50 to-blue-900/50 p-4">
      <div className="max-w-lg mx-auto">
        <header className="text-center text-white mb-6">
          <h1 className="text-2xl font-bold mb-1">🎭 パーティーモード</h1>
          <p className="text-sm text-white/80">専用ステージに挑戦。フレンドを誘って協力バトル！</p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 backdrop-blur-sm">
          <h2 className="font-bold text-white mb-3">パーティー編成 ({filledCount}/3)</h2>
          <div className="flex gap-2 mb-4 border-2 border-dashed border-white/20 rounded-xl p-3 min-h-[100px]">
            {party.map((m, i) => (
              <div key={i} className="flex-1 min-w-0">
                {m ? (
                  <div onClick={() => addToParty(m)} className="cursor-pointer">
                    <MemberCard member={m} showStats={true} />
                    <p className="text-center text-xs text-gray-400 mt-1">タップで外す</p>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 border-2 border-dashed border-white/20 rounded-lg text-sm">
                    空き
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={startParty}
              disabled={filledCount === 0}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold disabled:opacity-50 active:scale-[0.98] transition"
            >
              ステージを選ぶ
            </button>
            <button
              onClick={async () => {
                setShowInviteModal(true);
                await loadFriends();
              }}
              disabled={filledCount === 0}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold disabled:opacity-50 active:scale-[0.98] transition"
              title="フレンドを誘って協力バトル"
            >
              👥 誘う
            </button>
          </div>
        </div>

        {showInviteModal && (
          <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="rounded-2xl border border-white/10 bg-black/95 backdrop-blur-md p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
              <h3 className="text-xl font-bold mb-2 text-center text-white">👥 フレンドを誘う</h3>
              <p className="text-sm text-gray-400 text-center mb-4">招待するフレンドを選んでください</p>
              {friends.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                  <p className="text-amber-400 font-bold">フレンドがいません</p>
                  <p className="text-amber-300/80 text-sm mt-1">フレンド申請を送ってから誘ってください。</p>
                </div>
              ) : (
                <div className="space-y-2 flex-1 overflow-y-auto mb-4">
                  {friends.map((f) => (
                    <button
                      key={f.friend_id}
                      onClick={() => inviteFriend(f.friend_id)}
                      disabled={!!invitingFriendId}
                      className="w-full p-4 text-left rounded-2xl border border-white/10 bg-white/5 flex items-center gap-3 font-bold text-white active:scale-[0.98] transition"
                    >
                      <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg bg-gradient-to-br from-cyan-400 to-blue-500">
                        {(f.display_name || '?').charAt(0)}
                      </span>
                      <span className="flex-1 truncate">{f.display_name || '名前なし'}</span>
                      {invitingFriendId === f.friend_id ? (
                        <span className="text-cyan-400 text-sm animate-pulse">送信中...</span>
                      ) : (
                        <span className="text-cyan-400 text-sm">→ 招待</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-3 rounded-2xl bg-white/10 text-white font-bold border border-white/10 active:scale-[0.98] transition"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <h2 className="font-bold text-white mb-3">所持メンバー</h2>
          <div className="flex flex-wrap gap-3">
            {members.map((m) => (
              <div
                key={m.id}
                onClick={() => addToParty(m)}
                className={`cursor-pointer rounded-xl transition ${party.some(p => p?.id === m.id) ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-transparent' : ''}`}
              >
                <MemberCard member={m} showStats={true} />
              </div>
            ))}
          </div>
          {members.length === 0 && <p className="text-gray-500">メンバーがいません。ガチャでメンバーを増やしましょう。</p>}
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={() => router.push('/party/invites')} className="flex-1 py-2 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold active:scale-[0.98] transition">
            📬 招待を見る
          </button>
        </div>
      </div>
    </div>
  );
}
