'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

interface PartyStage {
  id: string;
  stage_order: number;
  name: string;
  description: string | null;
  recommended_level: number;
  enemies: unknown[];
  exp_reward: number;
  points_reward: number;
}

export default function PartyStagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partyIds = searchParams.get('party') || '';
  const inviteId = searchParams.get('invite_id') || '';
  const [stages, setStages] = useState<PartyStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  // 招待ロビー解散をリアルタイム検知（invite_id付きでステージ一覧表示中）
  useEffect(() => {
    if (!inviteId) return;
    const channel = supabase
      .channel(`party-invite-stages:${inviteId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'adventure_invites', filter: `id=eq.${inviteId}` },
        (payload: { new: { status?: string } }) => {
          if (payload.new?.status === 'cancelled') {
            router.push('/party?lobby_disbanded=1');
          }
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [inviteId, router]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    if (inviteId) {
      const { data: invite } = await supabase
        .from('adventure_invites')
        .select('status')
        .eq('id', inviteId)
        .single();
      if (invite?.status === 'cancelled') {
        router.push('/party?lobby_disbanded=1');
        setLoading(false);
        return;
      }
    }
    const { data } = await supabase
      .from('party_stages')
      .select('*')
      .eq('is_active', true)
      .order('stage_order', { ascending: true });
    setStages(data || []);
    setLoading(false);
  }

  function selectStage(stage: PartyStage) {
    if (inviteId) {
      router.push(`/party/stage/${stage.id}?invite_id=${inviteId}`);
    } else if (partyIds) {
      router.push(`/party/stage/${stage.id}?party=${partyIds}`);
    } else {
      router.push('/party');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
        <p className="text-white text-xl">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">🎭 パーティーステージ</h1>
          <p className="text-lg opacity-90">挑戦するステージを選んでください</p>
          {inviteId && <p className="text-cyan-300 mt-2">👥 協力バトルモード</p>}
        </div>

        <div className="space-y-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              onClick={() => selectStage(stage)}
              className="bg-white rounded-2xl p-6 shadow-xl cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border-2 border-transparent hover:border-cyan-400"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    ステージ{stage.stage_order}: {stage.name}
                  </h2>
                  {stage.description && (
                    <p className="text-gray-600 text-sm mt-1">{stage.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-orange-600 font-bold">推奨Lv.{stage.recommended_level}</span>
                    <span className="text-green-600">EXP: {stage.exp_reward}</span>
                    <span className="text-blue-600">pt: {stage.points_reward}</span>
                  </div>
                </div>
                <div className="text-4xl">
                  {(stage.enemies as { emoji?: string }[])?.[0]?.emoji || '⚔️'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {stages.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500">
            ステージがありません。supabase_party_stages.sql を実行してください。
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/party')}
            className="text-white hover:underline"
          >
            ← パーティー編成に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
