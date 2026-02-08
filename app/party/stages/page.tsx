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
  const [stages, setStages] = useState<PartyStage[]>([]);
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
    const { data } = await supabase
      .from('party_stages')
      .select('*')
      .eq('is_active', true)
      .order('stage_order', { ascending: true });
    setStages(data || []);
    setLoading(false);
  }

  function selectStage(stage: PartyStage) {
    if (!partyIds) {
      router.push('/party');
      return;
    }
    router.push(`/party/stage/${stage.id}?party=${partyIds}`);
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
