'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface FriendRequestWithProfile {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_tier: string;
  created_at: string;
}

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: reqData } = await supabase
      .from('friend_requests')
      .select('id, sender_id, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqData || reqData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const senderIds = [...new Set(reqData.map((r: { sender_id: string }) => r.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, membership_tier')
      .in('user_id', senderIds);

    const profileMap = new Map((profiles || []).map((p: { user_id: string; display_name?: string; membership_tier?: string }) => [p.user_id, p]));

    const formatted = reqData.map((req: { id: string; sender_id: string; created_at: string }) => {
      const p = profileMap.get(req.sender_id);
      return {
        id: req.id,
        sender_id: req.sender_id,
        sender_name: p?.display_name || '不明',
        sender_tier: p?.membership_tier || 'free',
        created_at: req.created_at
      };
    });

    setRequests(formatted);
    setLoading(false);
  }

  async function acceptRequest(requestId: string, senderId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // フレンド申請を承認
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateError) {
      alert('承認に失敗しました');
      return;
    }

    // 双方向のフレンドシップを作成（両者とも一覧に表示されるように2件）
    const { error: insertError } = await supabase.from('friendships').insert([
      { user_id: user.id, friend_id: senderId, status: 'accepted' },
      { user_id: senderId, friend_id: user.id, status: 'accepted' }
    ]);

    if (insertError) {
      alert('フレンド追加に失敗しました: ' + insertError.message + '（Supabaseで supabase_friend_fix.sql を実行してください）');
      return;
    }

    alert('フレンド申請を承認しました！');
    loadRequests();
  }

  async function rejectRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) {
      alert('拒否に失敗しました');
      return;
    }

    alert('フレンド申請を拒否しました');
    loadRequests();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">📬 フレンド申請</h1>
          <p className="text-lg opacity-90">受信した申請: {requests.length}件</p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold mb-2">申請はありません</h2>
            <p className="text-gray-600 mb-6">新しいフレンド申請が届くとここに表示されます</p>
            <button
              onClick={() => router.push('/friends/search')}
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-full font-bold hover:opacity-90"
            >
              プレイヤーを探す
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="space-y-4">
              {requests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {request.sender_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-lg">{request.sender_name}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleString('ja-JP')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => acceptRequest(request.id, request.sender_id)}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => rejectRequest(request.id)}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600"
                    >
                      拒否
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
