'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface FriendWithProfile {
  friend_id: string;
  display_name: string;
  avatar_url: string | null;
  membership_tier: string;
  is_online: boolean;
  last_seen_at: string;
}

interface FriendProfileRow {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  membership_tier?: string | null;
  last_seen_at?: string | null;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadFriends();
    loadPendingCount();
  }, []);

  async function loadFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 自分が user_id または friend_id の両方を取得（双方向）
    const { data: rows } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!rows || rows.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const friendIds = [...new Set(rows.map((r: { user_id: string; friend_id: string }) =>
      r.user_id === user.id ? r.friend_id : r.user_id
    ))];

    // フレンドのプロフィールを RPC で取得（RLS をバイパス）
    const { data: profiles } = await supabase.rpc('get_profiles_for_friends', {
      p_friend_ids: friendIds
    });

    const profileRows = (profiles ?? []) as FriendProfileRow[];
    const profileMap = new Map<string, FriendProfileRow>(
      profileRows.map(p => [p.user_id, p])
    );

    const formatted: FriendWithProfile[] = friendIds.map(fid => {
      const p = profileMap.get(fid);
      return {
        friend_id: fid,
        display_name: p?.display_name || 'ユーザー',
        avatar_url: p?.avatar_url ?? null,
        membership_tier: p?.membership_tier || 'free',
        is_online: isOnline(p?.last_seen_at ?? ''),
        last_seen_at: p?.last_seen_at || ''
      };
    });

    setFriends(formatted);
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

  function isOnline(lastSeenAt: string): boolean {
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2 text-orange-500">👥 フレンド</h1>
          <p className="text-lg text-gray-300">フレンド数: <span className="text-orange-400 font-bold">{friends.length}</span></p>
        </div>

        {/* メニューボタン */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/friends/search')}
            className="bg-gray-900 border border-orange-500/30 p-6 rounded-xl shadow-lg shadow-orange-500/10 hover:border-orange-500 hover:shadow-orange-500/20 transition text-white"
          >
            <div className="text-4xl mb-2">🔍</div>
            <div className="font-bold text-lg">プレイヤー検索</div>
          </button>
          <button
            onClick={() => router.push('/friends/requests')}
            className="bg-gray-900 border border-orange-500/30 p-6 rounded-xl shadow-lg shadow-orange-500/10 hover:border-orange-500 hover:shadow-orange-500/20 transition relative text-white"
          >
            <div className="text-4xl mb-2">📬</div>
            <div className="font-bold text-lg">フレンド申請</div>
            {pendingCount > 0 && (
              <div className="absolute top-2 right-2 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </div>
            )}
          </button>
        </div>

        {/* フレンドリスト */}
        {friends.length === 0 ? (
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-12 shadow-2xl shadow-orange-500/10 text-center">
            <div className="text-6xl mb-4">😊</div>
            <h2 className="text-2xl font-bold mb-2 text-white">フレンドがいません</h2>
            <p className="text-gray-300 mb-6">プレイヤーを検索してフレンド申請を送りましょう！</p>
            <button
              onClick={() => router.push('/friends/search')}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-500/30"
            >
              プレイヤーを探す
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
            <h2 className="text-xl font-bold mb-4 text-white">フレンド一覧</h2>
            <div className="space-y-3">
              {friends.map(friend => (
                <div
                  key={friend.friend_id}
                  className="flex items-center justify-between p-4 border-2 border-orange-500/20 bg-gray-800 rounded-lg hover:border-orange-500/50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                        style={{ display: friend.avatar_url ? 'none' : 'flex' }}
                      >
                        {(friend.display_name || '?').charAt(0)}
                      </div>
                      {friend.is_online && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 border-2 border-gray-900 rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-white">{friend.display_name}</div>
                      <div className="text-sm text-gray-400">
                        {friend.is_online ? (
                          <span className="text-orange-500">● オンライン</span>
                        ) : (
                          <span>最終: {friend.last_seen_at ? new Date(friend.last_seen_at).toLocaleString('ja-JP') : '---'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/pvp/matchmaking?friend=${friend.friend_id}`)}
                      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-500/30"
                    >
                      対戦する
                    </button>
                    <button
                      onClick={() => removeFriend(friend.friend_id)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition border border-gray-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="bg-gray-800 text-orange-500 border border-orange-500 px-8 py-3 rounded-lg font-bold hover:bg-gray-700 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
