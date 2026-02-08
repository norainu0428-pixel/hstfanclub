'use client';
/**
 * パーティーモード（冒険モードとは別）
 * 実装内容: パーティーを編成して専用ステージに挑戦。冒険の1〜400ステージとは独立。
 * フレンドを誘って協力バトル可能。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import PartySlotCard from '@/components/party/PartySlotCard';

interface PartyInviteSummary {
  id: string;
  host_name: string;
  status: string;
}

export default function PartyPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [isOwner, setIsOwner] = useState(false);
  const [partyInvites, setPartyInvites] = useState<PartyInviteSummary[]>([]);
  const [enteringLobby, setEnteringLobby] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const showDisbandedMessage = searchParams.get('lobby_disbanded') === '1';

  const pendingCount = partyInvites.filter(i => i.status === 'pending').length;
  const acceptedInvites = partyInvites.filter(i => i.status === 'accepted');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const [profileResult, membersResult, inviteResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_members').select('*').eq('user_id', user.id).order('level', { ascending: false }),
      supabase
        .from('adventure_invites')
        .select('id, host_id, status, invite_mode')
        .eq('friend_id', user.id)
        .in('status', ['pending', 'accepted'])
    ]);

    setIsOwner(profileResult.data?.role === 'owner');
    const membersData = membersResult.data || [];
    const filtered = profileResult.data?.role === 'owner'
      ? membersData
      : membersData.filter((m: Member) => m.rarity !== 'HST');
    setMembers(filtered);

    const partyInviteRows = (inviteResult.data || []).filter((r: { invite_mode?: string }) => r.invite_mode === 'party');
    if (partyInviteRows.length > 0) {
      const hostIds = [...new Set(partyInviteRows.map((r: { host_id: string }) => r.host_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', hostIds);
      const nameMap = new Map((profiles || []).map((p: { user_id: string; display_name: string }) => [p.user_id, p.display_name]));
      setPartyInvites(partyInviteRows.map((r: { id: string; host_id: string; status: string }) => ({
        id: r.id,
        host_name: nameMap.get(r.host_id) || 'ホスト',
        status: r.status
      })));
    } else {
      setPartyInvites([]);
    }

    setLoading(false);
  }

  async function enterLobby() {
    const filled = party.filter((m): m is Member => m !== null);
    if (filled.length !== 3) {
      alert('パーティを3体で組んでください');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setEnteringLobby(true);
    // 既存のロビー（friend_id=null）があれば削除
    await supabase
      .from('adventure_invites')
      .delete()
      .eq('host_id', user.id)
      .eq('invite_mode', 'party')
      .is('friend_id', null);

    const hostPartyIds = filled.map(m => m.id);
    const { data: invite, error } = await supabase
      .from('adventure_invites')
      .insert({
        host_id: user.id,
        friend_id: null,
        host_party_ids: hostPartyIds,
        status: 'lobby',
        invite_mode: 'party'
      })
      .select('id')
      .single();

    setEnteringLobby(false);
    if (error) {
      alert('ロビーに入れませんでした: ' + error.message);
      return;
    }
    router.push(`/party/lobby?invite_id=${invite.id}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-300">読み込み中...</p>
      </div>
    );
  }

  const filledCount = party.filter(m => m !== null).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">パーティーモード</h1>
          <p className="text-sm text-slate-400 mt-0.5">専用ステージに挑戦。フレンドを誘って協力バトル</p>
        </header>

        {showDisbandedMessage && (
          <div className="mb-4 rounded-xl bg-slate-700/80 border border-slate-500 p-3 text-slate-300 text-sm">
            ロビーが解散されました
          </div>
        )}

        {/* 招待が届いているときのバナー */}
        {pendingCount > 0 && (
          <div className="mb-4 rounded-xl bg-amber-500/20 border border-amber-500/50 p-4">
            <p className="font-bold text-amber-300">
              📬 {pendingCount}件のパーティ招待が届いています
            </p>
            <p className="text-slate-300 text-sm mt-1">パーティを選んで「参加する」でロビーに入れます</p>
            <button
              onClick={() => router.push('/party/invites')}
              className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 text-white font-bold active:scale-[0.98] transition"
            >
              招待を確認する →
            </button>
          </div>
        )}

        {/* 参加済みの招待 → ロビーに入る */}
        {acceptedInvites.length > 0 && (
          <div className="mb-4 rounded-xl bg-cyan-500/20 border border-cyan-500/50 p-4">
            <p className="font-bold text-cyan-300">ロビーに参加中</p>
            <p className="text-slate-300 text-sm mt-1">ホストがステージを選ぶと戦闘開始できます</p>
            <div className="mt-3 flex flex-col gap-2">
              {acceptedInvites.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => router.push(`/party/lobby?invite_id=${inv.id}`)}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 text-white font-bold active:scale-[0.98] transition"
                >
                  {inv.host_name} のロビーに入る
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 編成スロット */}
        <section className="mb-6">
          <p className="text-sm font-medium text-slate-300 mb-2">
            編成 <span className="text-cyan-400 font-bold">{filledCount}/3</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {party.map((m, i) => (
              <div key={i} className="min-w-0">
                {m ? (
                  <button
                    type="button"
                    onClick={() => addToParty(m)}
                    className="w-full text-left rounded-xl border-2 border-cyan-500/50 bg-slate-800/90 shadow-lg shadow-cyan-500/10 active:scale-[0.98] transition"
                  >
                    <PartySlotCard member={m} size="slot" />
                    <p className="text-center text-[10px] text-slate-500 py-1">タップで外す</p>
                  </button>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 min-h-[140px] flex flex-col items-center justify-center text-slate-500 text-sm">
                    <span className="text-2xl mb-1">＋</span>
                    <span>空き</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={startParty}
              disabled={filledCount === 0}
              className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
            >
              ステージを選ぶ
            </button>
            <button
              onClick={enterLobby}
              disabled={filledCount !== 3 || enteringLobby}
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
              title="3体選択後にロビーに入り、フレンドを招待"
            >
              {enteringLobby ? '入室中...' : 'ロビーに入る'}
            </button>
          </div>
        </section>

        {/* 所持メンバー */}
        <section>
          <p className="text-sm font-medium text-slate-300 mb-2">メンバーから選ぶ</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {members.map((m) => {
              const inParty = party.some(p => p?.id === m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addToParty(m)}
                  className={`min-w-0 rounded-xl text-left transition active:scale-[0.98] ${
                    inParty
                      ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 bg-slate-800'
                      : 'border border-slate-600 bg-slate-800/80 hover:border-slate-500'
                  }`}
                >
                  <PartySlotCard member={m} size="list" />
                </button>
              );
            })}
          </div>
          {members.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">メンバーがいません。ガチャで増やしましょう。</p>
          )}
        </section>

        <div className="mt-6">
          <button
            onClick={() => router.push('/party/invites')}
            className={`w-full py-2.5 rounded-xl border text-sm font-medium active:scale-[0.98] transition ${
              pendingCount > 0
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-slate-600 bg-slate-800 text-slate-300'
            }`}
          >
            {pendingCount > 0 ? `📬 招待を見る（${pendingCount}件）` : '招待を見る'}
          </button>
        </div>
      </div>
    </div>
  );
}
