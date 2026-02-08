'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import { Enemy } from '@/types/adventure';

export default function PartyStagePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const stageId = params.id as string;
  const partyIds = (searchParams.get('party') || '').split(',').filter(Boolean);
  const inviteId = searchParams.get('invite_id') || '';
  const [hostPartyIds, setHostPartyIds] = useState<string[]>([]);

  const [stage, setStage] = useState<{
    id: string;
    stage_order: number;
    name: string;
    description: string | null;
    recommended_level: number;
    enemies: Enemy[];
    exp_reward: number;
    points_reward: number;
  } | null>(null);
  const [party, setParty] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    if (inviteId) {
      const { data: invite, error: invErr } = await supabase
        .from('adventure_invites')
        .select('host_id, host_party_ids, friend_party_snapshot, invite_mode')
        .eq('id', inviteId)
        .single();
      if (invErr || !invite || invite.invite_mode !== 'party') {
        alert('招待情報の取得に失敗しました');
        router.push('/party');
        setLoading(false);
        return;
      }
      if (user.id !== invite.host_id) {
        alert('ホストのみバトルを開始できます');
        router.push('/party');
        setLoading(false);
        return;
      }
      const hostIds = (invite.host_party_ids || []).filter(Boolean);
      setHostPartyIds(hostIds);
      const snapshot = (invite.friend_party_snapshot || []) as Partial<Member>[];
      if (snapshot.length === 0) {
        alert('フレンドがまだ参加していません。フレンドがパーティを組むまでお待ちください。');
        router.push('/party/stages?invite_id=' + inviteId);
        setLoading(false);
        return;
      }
      const { data: hostMembers } = await supabase
        .from('user_members')
        .select('*')
        .in('id', hostIds);
      const host = (hostMembers || []).map((m: any) => ({ ...m, current_hp: m.current_hp ?? m.hp, hp: m.hp ?? m.max_hp }));
      const friend = snapshot.map((m: Partial<Member>) => ({ ...m, current_hp: m.hp ?? m.max_hp } as Member));
      setParty([...host, ...friend]);
    } else if (partyIds.length === 0) {
      router.push('/party');
      setLoading(false);
      return;
    } else {
      const { data: membersData } = await supabase
        .from('user_members')
        .select('*')
        .in('id', partyIds);
      const members = (membersData || []).map((m: any) => ({
        ...m,
        current_hp: m.current_hp ?? m.hp,
        hp: m.hp ?? m.max_hp
      }));
      setParty(members);
    }

    const { data: stageData, error: stageErr } = await supabase
      .from('party_stages')
      .select('*')
      .eq('id', stageId)
      .eq('is_active', true)
      .single();

    if (stageErr || !stageData) {
      alert('ステージが見つかりません');
      router.push(inviteId ? '/party/stages?invite_id=' + inviteId : '/party/stages');
      setLoading(false);
      return;
    }

    setStage({
      ...stageData,
      enemies: (stageData.enemies || []) as Enemy[]
    });
    setLoading(false);
  }

  async function startBattle() {
    if (inviteId) {
      // フレンドのロビーをバトルへリダイレクトするため、招待レコードを更新
      await supabase
        .from('adventure_invites')
        .update({ battle_party_stage_id: stageId, updated_at: new Date().toISOString() })
        .eq('id', inviteId);
      const mine = hostPartyIds.length > 0 ? hostPartyIds.join(',') : '';
      const q = new URLSearchParams({ party_stage_id: stageId, invite_id: inviteId });
      if (mine) q.set('mine', mine);
      router.push(`/adventure/battle?${q.toString()}`);
    } else {
      const ids = party.map(m => m.id).join(',');
      router.push(`/adventure/battle?party_stage_id=${stageId}&party=${ids}`);
    }
  }

  if (loading || !stage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
        <p className="text-white text-xl">読み込み中...</p>
      </div>
    );
  }

  const avgLevel = party.length > 0
    ? Math.round(party.reduce((s, m) => s + m.level, 0) / party.length)
    : 0;
  const levelDiff = avgLevel - stage.recommended_level;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">ステージ{stage.stage_order}: {stage.name}</h1>
          {stage.description && <p className="text-lg opacity-90 mb-4">{stage.description}</p>}
          <div className="bg-white/20 rounded-lg px-6 py-3 inline-block">
            <div className="text-xl font-bold mb-1">推奨レベル: {stage.recommended_level}</div>
            <div className="text-sm opacity-90">パーティ平均レベル: {avgLevel}</div>
            {levelDiff < -5 && <div className="mt-2 text-red-200 font-bold text-sm">⚠️ 推奨レベルより低いです</div>}
            {levelDiff >= -5 && levelDiff <= 5 && <div className="mt-2 text-yellow-200 font-bold text-sm">✓ 推奨レベル付近です</div>}
            {levelDiff > 5 && <div className="mt-2 text-green-200 font-bold text-sm">✓ 推奨レベルより高いです</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center">出現する敵</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stage.enemies.map((enemy, i) => (
              <div key={i} className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-400 rounded-xl p-6">
                <div className="text-center mb-4">
                  <div className="text-6xl mb-2">{enemy.emoji}</div>
                  <div className="text-2xl font-bold">{enemy.name}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">HP:</span><span className="font-bold text-red-600">{enemy.hp}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">攻撃:</span><span className="font-bold">{enemy.attack}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">防御:</span><span className="font-bold">{enemy.defense}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-gray-600">
            報酬: EXP {stage.exp_reward} / ポイント {stage.points_reward}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={startBattle}
            className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold text-xl hover:opacity-90"
          >
            戦闘開始
          </button>
          <button
            onClick={() => router.push(inviteId ? `/party/stages?invite_id=${inviteId}` : `/party/stages?party=${partyIds.join(',')}`)}
            className="px-6 py-4 bg-gray-500 text-white rounded-xl font-bold hover:bg-gray-600"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}
