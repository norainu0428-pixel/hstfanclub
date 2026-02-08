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

interface SentRequest {
  id: string;
  receiver_id: string;
  receiver_name: string;
  created_at: string;
}

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<FriendRequestWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSent, setLoadingSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadRequests();
    loadSentRequests();
  }, []);

  async function loadSentRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: reqRows } = await supabase
      .from('friend_requests')
      .select('id, receiver_id, created_at')
      .eq('sender_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqRows || reqRows.length === 0) {
      setSentRequests([]);
      return;
    }

    const receiverIds = [...new Set(reqRows.map((r: { receiver_id: string }) => r.receiver_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', receiverIds);

    const profileMap = new Map((profiles || []).map((p: { user_id: string; display_name: string }) => [p.user_id, p.display_name]));
    setSentRequests(reqRows.map((r: { id: string; receiver_id: string; created_at: string }) => ({
      id: r.id,
      receiver_id: r.receiver_id,
      receiver_name: profileMap.get(r.receiver_id) || '不明',
      created_at: r.created_at
    })));
  }

  async function loadRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: reqRows } = await supabase
      .from('friend_requests')
      .select('id, sender_id, created_at')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqRows || reqRows.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const senderIds = [...new Set(reqRows.map((r: { sender_id: string }) => r.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, membership_tier')
      .in('user_id', senderIds);

    const profileMap = new Map((profiles || []).map((p: { user_id: string; display_name: string; membership_tier: string }) => [p.user_id, p]));
    setRequests(reqRows.map((r: { id: string; sender_id: string; created_at: string }) => {
      const p = profileMap.get(r.sender_id);
      return {
        id: r.id,
        sender_id: r.sender_id,
        sender_name: p?.display_name || '不明',
        sender_tier: p?.membership_tier || 'free',
        created_at: r.created_at
      };
    }));
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

    // 双方向のフレンドシップを作成
    await supabase.from('friendships').insert([
      { user_id: user.id, friend_id: senderId, status: 'accepted' },
      { user_id: senderId, friend_id: user.id, status: 'accepted' }
    ]);

    alert('フレンド申請を承認しました！');
    loadRequests();
    loadSentRequests();
  }

  async function cancelSentRequest(requestId: string) {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      alert('キャンセルに失敗しました');
      return;
    }
    loadSentRequests();
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">フレンド申請</h1>
          <p className="text-sm text-slate-400 mt-0.5">受信: {requests.length}件 / 送信: {sentRequests.length}件</p>
        </header>

        {/* 送信した申請 */}
        {sentRequests.length > 0 && (
          <div className="rounded-2xl border border-slate-600 bg-slate-800 p-4 mb-6">
            <h2 className="font-bold text-white mb-3">送信した申請</h2>
            <div className="space-y-2">
              {sentRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-600 bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold bg-slate-600">
                      {req.receiver_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white">{req.receiver_name}</div>
                      <div className="text-xs text-slate-500">{new Date(req.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelSentRequest(req.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-600 text-slate-300 text-sm font-medium active:scale-[0.98]"
                  >
                    取り消す
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 受信した申請 */}
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-600 bg-slate-800 p-8 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-lg font-bold mb-2 text-white">受信した申請はありません</h2>
            <p className="text-slate-400 text-sm mb-4">新しいフレンド申請が届くとここに表示されます</p>
            <button
              onClick={() => router.push('/friends/search')}
              className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold active:scale-[0.98]"
            >
              プレイヤーを探す
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-600 bg-slate-800 p-4 mb-6">
            <h2 className="font-bold text-white mb-3">受信した申請</h2>
            <div className="space-y-2">
              {requests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-600 bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-orange-500/80">
                      {request.sender_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white">{request.sender_name}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(request.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(request.id, request.sender_id)}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-bold active:scale-[0.98]"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => rejectRequest(request.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-600 text-slate-300 text-sm font-medium active:scale-[0.98]"
                    >
                      拒否
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
