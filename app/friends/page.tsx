'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface FriendWithProfile {
  friend_id: string;
  display_name: string;
  membership_tier: string;
  is_online: boolean;
  last_seen_at: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    loadFriends();
    loadPendingCount();
  }, []);

  async function loadFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setMyUserId(user.id);

    // 双方向取得: user_id=me または friend_id=me
    const { data: rows } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const friendIds = [...new Set((rows || []).map((r: { user_id: string; friend_id: string }) =>
      r.user_id === user.id ? r.friend_id : r.user_id
    ))];

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, membership_tier, last_seen_at')
      .in('user_id', friendIds);

    if (profilesError && friendIds.length > 0) {
      console.warn('フレンドのプロフィール取得に失敗しました。Supabaseで supabase_fix_friend_display_names.sql を実行してください。', profilesError);
    }

    const profileMap = new Map((profiles || []).map((p: { user_id: string; display_name: string; membership_tier: string; last_seen_at: string }) => [p.user_id, p]));
    setFriends(friendIds.map((id) => {
      const p = profileMap.get(id);
      const displayName = (p?.display_name && p.display_name.trim()) || `プレイヤー${id.slice(0, 8)}`;
      return {
        friend_id: id,
        display_name: displayName,
        membership_tier: p?.membership_tier || 'free',
        is_online: isOnline(p?.last_seen_at),
        last_seen_at: p?.last_seen_at || ''
      };
    }));
    setLoading(false);
  }

  async function loadPendingCount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending');

    setPendingCount(count || 0);
  }

  function isOnline(lastSeenAt: string | undefined): boolean {
    if (!lastSeenAt) return false;
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    return diff < 5 * 60 * 1000; // 5分以内
  }

  async function removeFriend(friendId: string) {
    const confirmed = confirm('このフレンドを削除しますか？');
    if (!confirmed) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 双方向のフレンドシップを削除
    await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

    alert('フレンドを削除しました');
    loadFriends();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">フレンド</h1>
              <p className="text-sm text-slate-400 mt-0.5">フレンド数: <span className="text-orange-400 font-bold">{friends.length}</span></p>
            </div>
            {myUserId && (
              <div className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-right shrink-0">
                <p className="text-xs text-slate-400 mb-0.5">自分のID（送る用）</p>
                <p className="text-sm font-mono font-bold text-orange-400 break-all">プレイヤー-{myUserId.slice(0, 8)}</p>
              </div>
            )}
          </div>
        </header>

        {/* メニューボタン */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => router.push('/party/invites')}
            className="rounded-2xl p-4 bg-cyan-500/20 border border-cyan-500/50 font-bold text-left active:scale-[0.98] transition"
          >
            <span className="text-2xl block mb-1">🎭</span>
            <span className="text-sm">パーティの招待</span>
          </button>
          <button
            onClick={() => router.push('/friends/search')}
            className="rounded-2xl p-4 bg-orange-500/20 border border-orange-500/50 font-bold text-left active:scale-[0.98] transition"
          >
            <span className="text-2xl block mb-1">🔍</span>
            <span className="text-sm">プレイヤー検索</span>
          </button>
          <button
            onClick={() => router.push('/friends/requests')}
            className="rounded-2xl p-4 bg-orange-500/20 border border-orange-500/50 font-bold text-left active:scale-[0.98] transition relative"
          >
            <span className="text-2xl block mb-1">📬</span>
            <span className="text-sm">フレンド申請</span>
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* フレンドリスト */}
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-800/80 p-8 text-center">
            <div className="text-5xl mb-4">😊</div>
            <h2 className="text-lg font-bold mb-2 text-white">フレンドがいません</h2>
            <p className="text-slate-400 text-sm mb-4">プレイヤーを検索してフレンド申請を送りましょう</p>
            <button
              onClick={() => router.push('/friends/search')}
              className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold active:scale-[0.98] transition"
            >
              プレイヤーを探す
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-600 bg-slate-800/80 p-4">
            <h2 className="font-bold text-white mb-3">フレンド一覧</h2>
            <div className="space-y-2">
              {friends.map(friend => (
                <div
                  key={friend.friend_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-600 bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-orange-500 to-orange-600">
                        {friend.display_name.charAt(0)}
                      </div>
                      {friend.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-700" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white">{friend.display_name}</div>
                      <div className="text-xs text-slate-400">
                        {friend.is_online ? (
                          <span className="text-green-400">オンライン</span>
                        ) : (
                          <span>最終: {friend.last_seen_at ? new Date(friend.last_seen_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/pvp/matchmaking?friend=${friend.friend_id}`)}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-sm font-bold active:scale-[0.98]"
                    >
                      対戦
                    </button>
                    <button
                      onClick={() => removeFriend(friend.friend_id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-600 text-slate-300 text-sm font-medium active:scale-[0.98]"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-400 text-sm font-medium"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
