'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';

interface InviteRow {
  id: string;
  host_id: string;
  host_name: string;
  host_party_ids: string[];
  status: string;
}

export default function AdventureInvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<(Member | null)[]>([null, null, null]);
  const router = useRouter();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: inviteRows } = await supabase
      .from('adventure_invites')
      .select('id, host_id, host_party_ids, status')
      .eq('friend_id', user.id)
      .in('status', ['pending', 'accepted']);

    if (inviteRows && inviteRows.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', inviteRows.map(i => i.host_id));
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));
      setInvites(inviteRows.map(row => ({
        id: row.id,
        host_id: row.host_id,
        host_name: nameMap.get(row.host_id) || 'ホスト',
        host_party_ids: row.host_party_ids || [],
        status: row.status
      })));
    }

    const { data: myMembers } = await supabase
      .from('user_members')
      .select('*')
      .eq('user_id', user.id)
      .order('level', { ascending: false });
    setMembers((myMembers || []) as Member[]);
    setLoading(false);
  }

  function addToParty(m: Member) {
    if (selectedParty.some(x => x?.id === m.id)) {
      setSelectedParty(selectedParty.map(x => x?.id === m.id ? null : x));
      return;
    }
    const idx = selectedParty.findIndex(x => x === null);
    if (idx !== -1) {
      const next = [...selectedParty];
      next[idx] = m;
      setSelectedParty(next);
    }
  }

  async function acceptInvite(inviteId: string) {
    const filled = selectedParty.filter(m => m !== null);
    if (filled.length !== 3) {
      alert('パーティを3体で組んでください');
      return;
    }
    setAcceptingId(inviteId);
    const friendPartyIds = filled.map(m => m!.id);
    const snapshot = filled.map(m => {
      const { id, user_id, obtained_at, is_favorite, ...rest } = m! as Member & { user_id?: string; obtained_at?: string; is_favorite?: boolean };
      return { id, ...rest };
    });

    const { error } = await supabase
      .from('adventure_invites')
      .update({
        status: 'accepted',
        friend_party_ids: friendPartyIds,
        friend_party_snapshot: snapshot,
        updated_at: new Date().toISOString()
      })
      .eq('id', inviteId);

    setAcceptingId(null);
    if (error) {
      alert('参加に失敗しました: ' + error.message);
      return;
    }
    alert('参加しました！ホストが「一緒に冒険開始」を押すと冒険が始まります。');
    setSelectedParty([null, null, null]);
    load();
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
        <h1 className="text-3xl font-bold text-orange-500 mb-2 text-center">👥 冒険の招待</h1>
        <p className="text-gray-400 text-center mb-6">フレンドから届いた協力バトルの招待です</p>

        {invites.length === 0 ? (
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-12 text-center">
            <p className="text-gray-400">現在、招待はありません。</p>
            <button onClick={() => router.push('/adventure')} className="mt-4 text-orange-500 underline">冒険に戻る</button>
          </div>
        ) : (
          <div className="space-y-6">
            {invites.map(inv => (
              <div key={inv.id} className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{inv.host_name} から招待</h2>
                  <span className={`px-3 py-1 rounded-full text-sm ${inv.status === 'accepted' ? 'bg-green-500/30 text-green-400' : 'bg-orange-500/30 text-orange-400'}`}>
                    {inv.status === 'accepted' ? '参加済み' : '未参加'}
                  </span>
                </div>
                {inv.status === 'pending' && (
                  <>
                    <p className="text-gray-400 mb-4">あなたのパーティを3体選んで参加してください</p>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="border-2 border-dashed border-orange-500/30 rounded-lg p-2 min-h-[140px] flex items-center justify-center bg-gray-800/50">
                          {selectedParty[i] ? (
                            <div className="relative">
                              <MemberCard member={selectedParty[i]!} selected={true} showStats={false} />
                              <button
                                type="button"
                                onClick={() => setSelectedParty(prev => prev.map((m, j) => j === i ? null : m))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">スロット{i + 1}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-auto mb-4">
                      {members.map(m => (
                        <div key={m.id} onClick={() => addToParty(m)} className="cursor-pointer">
                          <MemberCard member={m} selected={selectedParty.some(p => p?.id === m.id)} showStats={false} />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => acceptInvite(inv.id)}
                      disabled={selectedParty.filter(Boolean).length !== 3 || acceptingId === inv.id}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      {acceptingId === inv.id ? '送信中...' : '参加する'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8">
          <button onClick={() => router.push('/adventure')} className="bg-gray-800 text-orange-500 border border-orange-500 px-8 py-3 rounded-lg font-bold">
            冒険に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
