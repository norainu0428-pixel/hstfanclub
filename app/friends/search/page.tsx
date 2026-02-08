'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  async function searchPlayers() {
    if (!searchTerm.trim()) {
      alert('検索キーワードを入力してください');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('ログインしてください');
      return;
    }

    setLoading(true);
    setResults([]);

    // プレイヤー検索
    const { data: players, error: searchError } = await supabase
      .from('profiles')
      .select('user_id, display_name, membership_tier, avatar_url')
      .ilike('display_name', `%${searchTerm}%`)
      .neq('user_id', user.id)
      .limit(20);

    if (searchError) {
      console.warn('プレイヤー検索エラー:', searchError);
      alert('検索に失敗しました。SupabaseダッシュボードのSQL Editorで supabase_fix_friend_display_names.sql を実行してください。\n\n（他ユーザーのプロフィール読取権限が必要です）');
      setLoading(false);
      return;
    }

    if (!players) {
      setLoading(false);
      return;
    }

    // フレンド状態をチェック（双方向）
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    // フレンド申請チェック
    const { data: requests } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .in('receiver_id', players.map(p => p.user_id));

    const friendIds = new Set((friendships || []).map((f: { user_id: string; friend_id: string }) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    ));

    const pendingIds = new Set(requests?.map(r => r.receiver_id) || []);

    const resultsWithStatus = players.map(player => ({
      ...player,
      is_friend: friendIds.has(player.user_id),
      has_pending_request: pendingIds.has(player.user_id)
    }));

    setResults(resultsWithStatus);
    setLoading(false);
  }

  async function sendFriendRequest(targetUserId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('friend_requests')
      .insert({
        sender_id: user.id,
        receiver_id: targetUserId,
        status: 'pending'
      });

    if (error) {
      if (error.code === '23505') {
        alert('既に申請済み、またはフレンドです');
      } else {
        alert('フレンド申請に失敗しました: ' + error.message);
      }
      return;
    }

    alert('フレンド申請を送信しました！');
    searchPlayers(); // 再検索
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">プレイヤー検索</h1>
          <p className="text-sm text-slate-400 mt-0.5">プレイヤー名で検索してフレンド申請を送れます</p>
        </header>

        {/* 検索フォーム */}
        <div className="rounded-2xl border border-slate-600 bg-slate-800 p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPlayers()}
              placeholder="プレイヤー名を入力..."
              className="flex-1 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-500"
            />
            <button
              onClick={searchPlayers}
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-orange-600 text-white font-bold active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? '...' : '検索'}
            </button>
          </div>
        </div>

        {/* 検索結果 */}
        {results.length > 0 && (
          <div className="rounded-2xl border border-slate-600 bg-slate-800 p-4 mb-6">
            <h2 className="font-bold text-white mb-3">検索結果 ({results.length})</h2>
            <div className="space-y-2">
              {results.map(player => (
                <div
                  key={player.user_id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-600 bg-slate-700/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-orange-500/80 flex-shrink-0">
                      {player.display_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{player.display_name || '不明'}</div>
                      <div className="text-xs text-slate-500 truncate">{player.user_id.slice(0, 8)}...</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {player.is_friend ? (
                      <span className="px-2 py-1 bg-green-500/30 text-green-400 rounded-lg text-xs font-bold">
                        フレンド
                      </span>
                    ) : player.has_pending_request ? (
                      <span className="px-2 py-1 bg-amber-500/30 text-amber-400 rounded-lg text-xs font-bold">
                        申請中
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(player.user_id)}
                        className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-sm font-bold active:scale-[0.98]"
                      >
                        申請
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !loading && searchTerm && (
          <p className="text-slate-500 text-sm text-center py-4">該当するプレイヤーがいません</p>
        )}

        <button
          onClick={() => router.push('/friends')}
          className="w-full py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-400 text-sm font-medium"
        >
          フレンド一覧に戻る
        </button>
      </div>
    </div>
  );
}
