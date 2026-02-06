'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import { getStageInfo } from '@/utils/stageGenerator';

export default function StagePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const stageId = parseInt(params.id as string);
  const partyIds = searchParams.get('party')?.split(',') || [];
  
  const [party, setParty] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParty();
  }, []);

  async function loadParty() {
    // ステージIDが無効な場合
    if (isNaN(stageId) || stageId < 1 || stageId > 400) {
      alert('無効なステージIDです');
      router.push('/adventure');
      return;
    }
    
    if (partyIds.length === 0) {
      router.push('/adventure');
      return;
    }

    const { data } = await supabase
      .from('user_members')
      .select('*')
      .in('id', partyIds);

    setParty(data || []);
    setLoading(false);
  }

  function startBattle() {
    const partyIdsParam = party.map(m => m.id).join(',');
    router.push(`/adventure/battle?stage=${stageId}&party=${partyIdsParam}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  const stageInfo = getStageInfo(stageId);
  const avgPartyLevel = party.length > 0 
    ? Math.round(party.reduce((sum, m) => sum + m.level, 0) / party.length)
    : 0;
  const levelDiff = avgPartyLevel - stageInfo.recommendedLevel;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">ステージ {stageId}</h1>
          <p className="text-lg opacity-90 mb-4">敵が現れた！</p>
          <div className="bg-white/20 rounded-lg px-6 py-3 inline-block">
            <div className="text-xl font-bold mb-1">
              推奨レベル: {stageInfo.recommendedLevel}
            </div>
            <div className="text-sm opacity-90">
              パーティ平均レベル: {avgPartyLevel}
            </div>
            {levelDiff < -5 && (
              <div className="mt-2 text-red-200 font-bold text-sm">
                ⚠️ 推奨レベルより{Math.abs(levelDiff)}レベル低いです！
              </div>
            )}
            {levelDiff >= -5 && levelDiff <= 5 && (
              <div className="mt-2 text-yellow-200 font-bold text-sm">
                ✓ 推奨レベル付近です
              </div>
            )}
            {levelDiff > 5 && (
              <div className="mt-2 text-green-200 font-bold text-sm">
                ✓ 推奨レベルより{levelDiff}レベル高いです
              </div>
            )}
          </div>
        </div>

        {/* 敵情報 */}
        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center">出現する敵</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stageInfo.enemies.map((enemy, index) => (
              <div key={index} className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-400 rounded-xl p-6 shadow-lg">
                <div className="text-center mb-4">
                  <div className="text-6xl mb-2">{enemy.emoji}</div>
                  <div className="text-2xl font-bold">{enemy.name}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">HP:</span>
                    <span className="font-bold text-red-600">{enemy.hp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">攻撃力:</span>
                    <span className="font-bold">{enemy.attack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">防御力:</span>
                    <span className="font-bold">{enemy.defense}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">素早さ:</span>
                    <span className="font-bold">{enemy.speed}</span>
                  </div>
                  <div className="border-t-2 border-gray-300 my-2"></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-600">経験値:</span>
                    <span className="font-bold">{enemy.experience_reward}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">ポイント:</span>
                    <span className="font-bold">{enemy.points_reward}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* パーティ情報 */}
        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center">あなたのパーティ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {party.map(member => (
              <div key={member.id} className="bg-gradient-to-br from-blue-50 to-purple-50 border-4 border-blue-400 rounded-xl p-4">
                <div className="text-center mb-3">
                  <div className="text-4xl mb-2">{member.member_emoji}</div>
                  <div className="font-bold">{member.member_name}</div>
                  <div className="text-sm text-gray-500">Lv.{member.level}</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">HP:</span>
                    <span className="font-bold text-red-600">{member.hp}/{member.max_hp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ATK:</span>
                    <span className="font-bold">{member.attack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DEF:</span>
                    <span className="font-bold">{member.defense}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SPD:</span>
                    <span className="font-bold">{member.speed}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* バトル開始ボタン */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={startBattle}
            className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-16 py-5 rounded-full text-2xl font-bold shadow-2xl hover:scale-105 transition"
          >
            ⚔️ 戦闘開始！
          </button>
          <button
            onClick={() => router.push('/adventure')}
            className="bg-white text-gray-600 px-8 py-5 rounded-full text-xl font-bold border-2 border-gray-300 hover:bg-gray-50 transition"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}
