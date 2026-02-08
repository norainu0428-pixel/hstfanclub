'use client';
/**
 * パーティーモード ロビー
 * 招待したフレンドの参加をリアルタイムで表示し、ステージ選択して戦闘開始
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';

interface PartyStage {
  id: string;
  stage_order: number;
  name: string;
  recommended_level: number;
  exp_reward: number;
  points_reward: number;
}

interface InviteData {
  id: string;
  host_id: string;
  host_party_ids: string[];
  friend_id: string;
  friend_party_snapshot: Partial<Member>[] | null;
  status: string;
  host_name?: string;
  friend_name?: string;
}

export default function PartyLobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inviteId = searchParams.get('invite_id') || '';
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [hostParty, setHostParty] = useState<Member[]>([]);
  const [friendParty, setFriendParty] = useState<Member[]>([]);
  const [stages, setStages] = useState<PartyStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [disbanding, setDisbanding] = useState(false);
  const isHost = currentUserId && invite && currentUserId === invite.host_id;

  const loadInvite = useCallback(async () => {
    if (!inviteId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    setCurrentUserId(user.id);

    const { data: inviteData, error } = await supabase
      .from('adventure_invites')
      .select('id, host_id, host_party_ids, friend_id, friend_party_snapshot, status, invite_mode')
      .eq('id', inviteId)
      .single();

    if (error || !inviteData || inviteData.invite_mode !== 'party') {
      alert('ロビー情報の取得に失敗しました');
      router.push('/party');
      return;
    }
    if (inviteData.status === 'cancelled') {
      setLoading(false);
      router.push('/party?lobby_disbanded=1');
      return;
    }

    const inInvite = user.id === inviteData.host_id || user.id === inviteData.friend_id;
    if (!inInvite) {
      alert('このロビーに参加する権限がありません');
      router.push('/party');
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', [inviteData.host_id, inviteData.friend_id]);
    const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));

    setInvite({
      ...inviteData,
      host_name: nameMap.get(inviteData.host_id) || 'ホスト',
      friend_name: nameMap.get(inviteData.friend_id) || 'フレンド'
    });

    const hostIds = (inviteData.host_party_ids || []).filter(Boolean);
    if (hostIds.length > 0) {
      const { data: hostMembers } = await supabase
        .from('user_members')
        .select('*')
        .in('id', hostIds);
      setHostParty((hostMembers || []).map((m: any) => ({ ...m, current_hp: m.current_hp ?? m.hp, hp: m.hp ?? m.max_hp })));
    }

    const snapshot = (inviteData.friend_party_snapshot || []) as Partial<Member>[];
    if (snapshot.length > 0) {
      setFriendParty(snapshot.map(m => ({ ...m, current_hp: m.hp ?? m.max_hp } as Member)));
    }
    setLoading(false);
  }, [inviteId, router]);

  useEffect(() => {
    if (!inviteId) {
      setLoading(false);
      return;
    }
    loadInvite();
  }, [inviteId, loadInvite, router]);

  useEffect(() => {
    async function loadStages() {
      const { data } = await supabase
        .from('party_stages')
        .select('id, stage_order, name, recommended_level, exp_reward, points_reward')
        .eq('is_active', true)
        .order('stage_order', { ascending: true });
      setStages(data || []);
    }
    loadStages();
  }, []);

  useEffect(() => {
    if (!inviteId) return;
    const channel = supabase
      .channel(`party-invite:${inviteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'adventure_invites',
          filter: `id=eq.${inviteId}`
        },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow.status === 'cancelled') {
            router.push('/party?lobby_disbanded=1');
            return;
          }
          if (newRow.friend_party_snapshot && Array.isArray(newRow.friend_party_snapshot)) {
            setFriendParty(newRow.friend_party_snapshot.map((m: Partial<Member>) => ({ ...m, current_hp: m.hp ?? m.max_hp } as Member)));
          }
          setInvite(prev => prev ? { ...prev, status: newRow.status, friend_party_snapshot: newRow.friend_party_snapshot } : null);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [inviteId]);

  function startBattle() {
    if (!selectedStageId || !inviteId) {
      alert('ステージを選択してください');
      return;
    }
    if (invite?.status !== 'accepted' && isHost) {
      alert('フレンドの参加を待ってください');
      return;
    }
    router.push(`/party/stage/${selectedStageId}?invite_id=${inviteId}`);
  }

  async function disbandLobby() {
    if (!isHost || !inviteId || disbanding) return;
    if (!confirm('ロビーを解散しますか？フレンドにも通知されます。')) return;
    setDisbanding(true);
    const { error } = await supabase
      .from('adventure_invites')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', inviteId);
    setDisbanding(false);
    if (error) {
      alert('解散に失敗しました: ' + error.message);
      return;
    }
    router.push('/party');
  }

  if (!inviteId) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center">
        <p className="text-slate-400 mb-4">ロビーIDがありません</p>
        <p className="text-slate-500 text-sm text-center mb-6">招待から参加するか、パーティーでフレンドを誘ってロビーに入ってください</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button onClick={() => router.push('/party/invites')} className="py-3 rounded-xl bg-amber-600 text-white font-bold">
            招待を確認する
          </button>
          <button onClick={() => router.push('/party')} className="py-3 rounded-xl border border-slate-600 text-slate-300 font-medium">
            パーティーモードへ
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">ロビーを読み込み中...</p>
      </div>
    );
  }

  if (!invite) return null;

  const friendJoined = invite.status === 'accepted' && friendParty.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-white">パーティー ロビー</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isHost ? 'ステージを選んで「戦闘開始」で始められます' : 'ホストが開始するまでお待ちください'}
          </p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            リアルタイム同期
          </span>
        </header>

        {/* パーティー表示 */}
        <div className="space-y-4 mb-6">
          <section className="rounded-xl border border-slate-600 bg-slate-800 p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-2">ホスト {invite.host_name}</h3>
            <div className="flex gap-2 flex-wrap">
              {hostParty.map((m) => (
                <div key={m.id} className="flex-shrink-0">
                  <MemberCard member={m} showStats={true} />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-600 bg-slate-800 p-4">
            <h3 className="text-sm font-bold text-cyan-400 mb-2">
              フレンド {invite.friend_name}
              {!friendJoined && (
                <span className="text-amber-400 font-normal text-xs ml-2">（参加待ち・招待から「参加する」で参加）</span>
              )}
            </h3>
            {friendJoined ? (
              <div className="flex gap-2 flex-wrap">
                {friendParty.map((m, i) => (
                  <div key={m.id || i} className="flex-shrink-0">
                    <MemberCard member={m as Member} showStats={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[80px] flex items-center justify-center border-2 border-dashed border-slate-600 rounded-lg bg-slate-700/30">
                <p className="text-slate-500 text-sm">フレンドの参加を待っています</p>
              </div>
            )}
          </section>
        </div>

        {/* ステージ選択（ホスト用） */}
        <section className="rounded-xl border border-slate-600 bg-slate-800 p-4 mb-6">
          <h2 className="font-bold text-white mb-3">ステージを選ぶ</h2>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`p-3 rounded-xl text-left text-sm transition border-2 ${
                  selectedStageId === stage.id
                    ? 'border-cyan-500 bg-cyan-500/20 text-white'
                    : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-slate-400 text-xs">ステージ{stage.stage_order}</span>
                <p className="truncate font-medium">{stage.name}</p>
                <p className="text-xs text-orange-400 mt-0.5">推奨Lv.{stage.recommended_level}</p>
              </button>
            ))}
          </div>
        </section>

        {/* アクション */}
        <div className="space-y-3">
          {isHost ? (
            <>
              <button
                onClick={startBattle}
                disabled={!friendJoined || !selectedStageId}
                className="w-full py-3 rounded-xl bg-cyan-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
              >
                戦闘開始！
              </button>
              {!friendJoined && (
                <p className="text-amber-400 text-sm text-center">フレンドが「招待を確認」→「参加する」で参加すると開始できます</p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-slate-600 bg-slate-800 p-4 text-center">
              <p className="text-slate-300 text-sm">ホストがステージを選んで「戦闘開始」を押すと始まります</p>
            </div>
          )}
          {isHost && (
            <button
              onClick={disbandLobby}
              disabled={disbanding}
              className="w-full py-2.5 rounded-xl border border-red-500/50 bg-red-500/20 text-red-400 text-sm font-medium disabled:opacity-50"
            >
              {disbanding ? '解散中...' : 'ロビーを解散する'}
            </button>
          )}
          <button
            onClick={() => router.push('/party')}
            className="w-full py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-400 text-sm font-medium"
          >
            ロビーを出る
          </button>
        </div>
      </div>
    </div>
  );
}
