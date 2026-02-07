'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface SearchProfileRow {
  user_id: string;
  display_name: string | null;
  membership_tier?: string | null;
}

interface PlayerSearchResult {
  user_id: string;
  display_name: string;
  membership_tier: string;
  avatar_url?: string;
  is_friend: boolean;
  has_pending_request: boolean;
}

export default function PlayerSearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    getCurrentUser();
  }, []);

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function searchPlayers() {
    const term = searchTerm.trim();
    if (!term) {
      alert('検索キーワードを入力してください');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const myId = user?.id ?? currentUserId;
    if (!myId) {
      alert('ログインしてください');
      setLoading(false);
      return;
    }

    // RPC で検索（RLS をバイパスして確実に結果を取得）
    const { data, error } = await supabase.rpc('search_profiles_for_friends', {
      p_search_term: term,
      p_exclude_user_id: myId
    });

    if (error) {
      console.error('search_profiles_for_friends error:', error);
      alert('検索に失敗しました: ' + error.message + '（supabase_friend_fix.sql の RPC を実行してください）');
      setResults([]);
      setLoading(false);
      return;
    }

    const players: SearchProfileRow[] = (data ?? []) as SearchProfileRow[];
    if (players.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // フレンド状態をチェック
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, status')
      .eq('user_id', myId)
      .in('friend_id', players.map(p => p.user_id));

    // フレンド申請チェック
    const { data: requests } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', myId)
      .eq('status', 'pending')
      .in('receiver_id', players.map(p => p.user_id));

    const friendIds = new Set(friendships?.filter(f => f.status === 'accepted').map(f => f.friend_id) || []);
    const pendingIds = new Set(requests?.map(r => r.receiver_id) || []);

    // 双方向の friendships もチェック（friend_id が自分側の行）
    const { data: revFriendships } = await supabase
      .from('friendships')
      .select('user_id, status')
      .eq('friend_id', myId)
      .in('user_id', players.map(p => p.user_id));
    revFriendships?.filter(f => f.status === 'accepted').forEach(f => friendIds.add(f.user_id));

    const resultsWithStatus: PlayerSearchResult[] = players.map(player => ({
      user_id: player.user_id,
      display_name: player.display_name ?? '不明',
      membership_tier: player.membership_tier ?? 'free',
      is_friend: friendIds.has(player.user_id),
      has_pending_request: pendingIds.has(player.user_id)
    }));

    setResults(resultsWithStatus);
    setLoading(false);
  }

  async function sendFriendRequest(targetUserId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: currentUserId,
        receiver_id: targetUserId,
        status: 'pending'
      });

    if (error) {
      alert('フレンド申請に失敗しました');
      return;
    }

    alert('フレンド申請を送信しました！');
    searchPlayers(); // 再検索
  }

  function getTierBadge(tier: string) {
    const badges: any = {
      free: { bg: 'bg-gray-100', text: 'text-gray-700', label: '無料' },
      basic: { bg: 'bg-blue-100', text: 'text-blue-700', label: '通常' },
      premium: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'プレミアム' }
    };
    const badge = badges[tier] || badges.free;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🔍 プレイヤー検索</h1>
          <p className="text-lg opacity-90">フレンドを探そう！</p>
        </div>

        {/* 検索フォーム */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchPlayers()}
              placeholder="プレイヤー名 または フレンドID（先頭8文字以上）"
              className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-900 placeholder-gray-500 bg-white"
            />
            <button
              onClick={searchPlayers}
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '検索中...' : '検索'}
            </button>
          </div>
        </div>

        {/* 自分のフレンドID表示 */}
        <div className="bg-white/20 rounded-xl p-4 mb-6 text-white">
          <p className="text-sm opacity-90">あなたのフレンドID（友達に教えて検索してもらおう）</p>
          <p className="font-mono font-bold text-lg mt-1 break-all">{currentUserId || '読み込み中...'}</p>
        </div>

        {/* 検索結果 */}
        {results.length > 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">検索結果 ({results.length})</h2>
            <div className="space-y-3">
              {results.map(player => (
                <div
                  key={player.user_id}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {player.display_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{player.display_name}</div>
                      <div className="text-sm text-gray-500">ID: {player.user_id.slice(0, 8)}...</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getTierBadge(player.membership_tier)}
                    {player.is_friend ? (
                      <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-sm">
                        フレンド
                      </span>
                    ) : player.has_pending_request ? (
                      <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-bold text-sm">
                        申請中
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(player.user_id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600"
                      >
                        申請する
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !loading && searchTerm.trim() ? (
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center text-gray-600">
            <p className="font-bold mb-2">検索結果が見つかりませんでした</p>
            <p className="text-sm">・表示名の一部、またはフレンドID（先頭8文字以上）で検索できます</p>
            <p className="text-sm">・該当するプレイヤーがいない可能性があります</p>
          </div>
        ) : null}

        {/* 戻るボタン */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/friends')}
            className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            フレンド一覧に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
