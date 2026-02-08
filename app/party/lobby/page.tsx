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
      router.push('/party');
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

  if (!inviteId || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
        <p className="text-white text-xl">ロビーを読み込み中...</p>
      </div>
    );
  }

  if (!invite) return null;

  const friendJoined = invite.status === 'accepted' && friendParty.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center text-white mb-6">
          <h1 className="text-4xl font-bold mb-2">🎭 パーティー ロビー</h1>
          <p className="text-lg opacity-90">協力バトルの準備ができたらステージを選んで戦闘開始</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              リアルタイム同期
            </span>
          </div>
        </div>

        {/* パーティー表示 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-sm">ホスト</span>
              {invite.host_name} のパーティー
            </h3>
            <div className="flex gap-3 flex-wrap">
              {hostParty.map((m) => (
                <div key={m.id} className="flex-shrink-0">
                  <MemberCard member={m} showStats={true} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="bg-cyan-500 text-white px-2 py-0.5 rounded text-sm">フレンド</span>
              {invite.friend_name} のパーティー
              {!friendJoined && (
                <span className="text-amber-600 text-sm font-normal">
                  参加待ち...（フレンドは「パーティの招待」から参加）
                </span>
              )}
            </h3>
            {friendJoined ? (
              <div className="flex gap-3 flex-wrap">
                {friendParty.map((m, i) => (
                  <div key={m.id || i} className="flex-shrink-0">
                    <MemberCard member={m as Member} showStats={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 min-h-[100px] items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                <p className="text-gray-500">フレンドが参加するまでお待ちください</p>
              </div>
            )}
          </div>
        </div>

        {/* ステージ選択 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="text-xl font-bold mb-4">ステージを選ぶ</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-h-60 overflow-y-auto">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`p-4 rounded-xl text-left font-bold transition border-2 ${
                  selectedStageId === stage.id
                    ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-400'
                    : 'border-gray-200 hover:border-cyan-300 bg-gray-50'
                }`}
              >
                <div className="text-sm text-gray-600">ステージ{stage.stage_order}</div>
                <div className="truncate">{stage.name}</div>
                <div className="text-xs text-orange-600 mt-1">推奨Lv.{stage.recommended_level}</div>
              </button>
            ))}
          </div>
        </div>

        {/* アクション */}
        <div className="flex flex-wrap gap-4 justify-center">
          {isHost ? (
            <>
              <button
                onClick={startBattle}
                disabled={!friendJoined || !selectedStageId}
                className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold text-xl disabled:opacity-50 hover:opacity-90 shadow-lg"
              >
                戦闘開始！
              </button>
              {!friendJoined && (
                <p className="text-amber-600 font-bold py-4">フレンドの参加を待っています...</p>
              )}
            </>
          ) : (
            <div className="bg-white/20 rounded-xl px-8 py-4 text-white">
              <p className="font-bold">ホストがステージを選んで戦闘を開始するまでお待ちください</p>
            </div>
          )}
          <button
            onClick={() => router.push('/party')}
            className="px-6 py-4 bg-gray-500 text-white rounded-xl font-bold hover:bg-gray-600"
          >
            ロビーを出る
          </button>
        </div>
      </div>
    </div>
  );
}
