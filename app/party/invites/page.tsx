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

export default function PartyInvitesPage() {
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
      .select('id, host_id, host_party_ids, status, invite_mode')
      .eq('friend_id', user.id)
      .in('status', ['pending', 'accepted']);

    const partyInvites = (inviteRows || []).filter((r: { invite_mode?: string }) => r.invite_mode === 'party');
    if (partyInvites.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', partyInvites.map((i: { host_id: string }) => i.host_id));
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));
      setInvites(partyInvites.map((row: { id: string; host_id: string; host_party_ids?: string[]; status: string }) => ({
        id: row.id,
        host_id: row.host_id,
        host_name: nameMap.get(row.host_id) || 'ホスト',
        host_party_ids: row.host_party_ids || [],
        status: row.status
      })));
    } else {
      setInvites([]);
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
    if (filled.length === 0) {
      alert('パーティに1体以上選んでください');
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
    setSelectedParty([null, null, null]);
    router.push(`/party/lobby?invite_id=${inviteId}`);
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
          <h1 className="text-xl font-bold text-white">パーティの招待</h1>
          <p className="text-sm text-slate-400 mt-0.5">フレンドから届いた協力プレイの招待です。参加するとロビーに入れます</p>
        </header>

        {invites.length === 0 ? (
          <div className="rounded-xl border border-slate-600 bg-slate-800/80 p-8 text-center">
            <p className="text-slate-400 mb-4">現在、招待はありません。</p>
            <button onClick={() => router.push('/party')} className="text-cyan-400 font-bold">← パーティーモードに戻る</button>
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map(inv => (
              <div key={inv.id} className="rounded-xl border border-slate-600 bg-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-white">{inv.host_name} から招待</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${inv.status === 'accepted' ? 'bg-green-500/30 text-green-300' : 'bg-amber-500/30 text-amber-300'}`}>
                    {inv.status === 'accepted' ? '参加済み' : '未参加'}
                  </span>
                </div>

                {inv.status === 'accepted' ? (
                  <button
                    onClick={() => router.push(`/party/lobby?invite_id=${inv.id}`)}
                    className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold active:scale-[0.98] transition"
                  >
                    ロビーに入る
                  </button>
                ) : (
                  <>
                    <p className="text-slate-400 text-sm mb-3">1〜3体選んで「参加する」を押すとロビーに入れます</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="border-2 border-dashed border-slate-500 rounded-lg p-2 min-h-[100px] flex items-center justify-center bg-slate-700/50">
                          {selectedParty[i] ? (
                            <div className="relative w-full">
                              <MemberCard member={selectedParty[i]!} selected={true} showStats={false} />
                              <button
                                type="button"
                                onClick={() => setSelectedParty(prev => prev.map((m, j) => j === i ? null : m))}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">スロット{i + 1}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-auto mb-3">
                      {members.map(m => (
                        <div key={m.id} onClick={() => addToParty(m)} className="cursor-pointer">
                          <MemberCard member={m} selected={selectedParty.some(p => p?.id === m.id)} showStats={false} />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => acceptInvite(inv.id)}
                      disabled={selectedParty.filter(Boolean).length === 0 || acceptingId === inv.id}
                      className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold disabled:opacity-50 active:scale-[0.98] transition"
                    >
                      {acceptingId === inv.id ? '送信中...' : '参加する（ロビーへ）'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <button onClick={() => router.push('/party')} className="w-full py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-sm font-medium">
            パーティーモードに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
