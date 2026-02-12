'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import { getStageInfo, isExtraStage, isLevelTrainingStage, LEVEL_TRAINING_STAGES } from '@/utils/stageGenerator';

// レベルアップ専用ステージの1日あたりの基本挑戦回数
const LEVEL_TRAINING_DAILY_LIMIT = 5;

export default function StagePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const stageId = parseInt(params.id as string);
  const partyIdsParam = searchParams.get('party') || '';
  const partyIds = partyIdsParam && partyIdsParam !== '_' ? partyIdsParam.split(',').filter(Boolean) : [];
  const inviteId = searchParams.get('invite_id') || '';
  
  const [party, setParty] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostPartyIds, setHostPartyIds] = useState<string[]>([]);

  useEffect(() => {
    loadParty();
  }, []);

  async function loadParty() {
    if (
      isNaN(stageId) ||
      stageId < 1 ||
      (!isExtraStage(stageId) && stageId > 400 && stageId < 2001) // 401〜2000 は通常バトルからは無効
    ) {
      alert('無効なステージIDです');
      router.push('/adventure');
      return;
    }

    // レベルアップ専用ステージの場合は、直接URL叩きなどで無限に挑戦できないようサーバー側で回数チェック
    if (isLevelTrainingStage(stageId)) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const { count } = await supabase
        .from('battle_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('stage', LEVEL_TRAINING_STAGES as unknown as number[])
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      const usedToday = count || 0;
      const baseRemaining = Math.max(0, LEVEL_TRAINING_DAILY_LIMIT - usedToday);

      const { data: profile } = await supabase
        .from('profiles')
        .select('level_training_bonus_plays')
        .eq('user_id', user.id)
        .maybeSingle();

      const bonus = (profile as { level_training_bonus_plays?: number } | null)?.level_training_bonus_plays ?? 0;
      const totalRemaining = baseRemaining + bonus;

      if (totalRemaining <= 0) {
        alert(`レベルアップステージは1日${LEVEL_TRAINING_DAILY_LIMIT}回までです（ボーナス含めて上限に達しました）。また明日お試しください。`);
        router.push('/adventure/level-training');
        return;
      }
    }
    
    if (inviteId) {
      const { data: invite, error } = await supabase
        .from('adventure_invites')
        .select('host_id, host_party_ids, friend_party_snapshot')
        .eq('id', inviteId)
        .single();
      if (error || !invite) {
        alert('招待情報の取得に失敗しました');
        router.push('/adventure');
        return;
      }
      const hostIds = (invite.host_party_ids || []).filter(Boolean);
      setHostPartyIds(hostIds);
      const snapshot = (invite.friend_party_snapshot || []) as Partial<Member>[];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== invite.host_id) {
        router.push('/adventure');
        return;
      }
      const { data: hostMembers } = await supabase
        .from('user_members')
        .select('*')
        .in('id', hostIds);
      const host = (hostMembers || []).map(m => ({ ...m, current_hp: m.current_hp ?? m.hp, hp: m.hp ?? m.max_hp }));
      const friend = snapshot.map(m => ({ ...m, current_hp: m.hp ?? m.max_hp } as Member));
      setParty([...host, ...friend]);
      setLoading(false);
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
    if (inviteId) {
      const mine = hostPartyIds.length > 0 ? hostPartyIds.join(',') : '';
      const q = new URLSearchParams({ stage: String(stageId), invite_id: inviteId });
      if (mine) q.set('mine', mine);
      router.push(`/adventure/battle?${q.toString()}`);
      return;
    }
    const ids = party.map(m => m.id).join(',');
    router.push(`/adventure/battle?stage=${stageId}&party=${ids}`);
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
          <h1 className="text-4xl font-bold mb-2">
            {isLevelTrainingStage(stageId)
              ? `📘 レベルアップステージ ${stageId}`
              : isExtraStage(stageId)
              ? `⭐ エクストラ ステージ ${stageId}`
              : `ステージ ${stageId}`}
          </h1>
          <p className="text-lg opacity-90 mb-4">
            {isLevelTrainingStage(stageId)
              ? 'レベルアップ専用の特別ステージです。経験値が多く、ポイントは控えめです。'
              : isExtraStage(stageId)
              ? '最強スキル持ちの強敵が登場する高難度ステージ'
              : '敵が現れた！'}
          </p>
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
          <h2 className="text-2xl font-bold mb-6 text-center text-black">出現する敵</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stageInfo.enemies.map((enemy, index) => (
              <div key={index} className="bg-gradient-to-br from-red-50 to-orange-50 border-4 border-red-400 rounded-xl p-6 shadow-lg">
                <div className="text-center mb-4">
                  <div className="text-6xl mb-2">{enemy.emoji}</div>
                  <div className="text-2xl font-bold text-black">{enemy.name}</div>
                </div>
                <div className="space-y-2 text-black">
                  <div className="flex justify-between">
                    <span>HP:</span>
                    <span className="font-bold">{enemy.hp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>攻撃力:</span>
                    <span className="font-bold">{enemy.attack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>防御力:</span>
                    <span className="font-bold">{enemy.defense}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>素早さ:</span>
                    <span className="font-bold">{enemy.speed}</span>
                  </div>
                  <div className="border-t-2 border-gray-300 my-2"></div>
                  <div className="flex justify-between text-sm">
                    <span>経験値:</span>
                    <span className="font-bold">{enemy.experience_reward}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>ポイント:</span>
                    <span className="font-bold">{enemy.points_reward}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* パーティ情報 */}
        <div className="bg-white rounded-2xl p-8 mb-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">{inviteId ? '協力パーティ' : 'あなたのパーティ'}</h2>
          <div className={`grid gap-4 ${party.length > 3 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-1 md:grid-cols-3'}`}>
            {party.map(member => (
              <div key={member.id} className="bg-gradient-to-br from-blue-50 to-purple-50 border-4 border-blue-400 rounded-xl p-4 text-gray-900">
                <div className="text-center mb-3">
                  <div className="text-4xl mb-2">{member.member_emoji}</div>
                  <div className="font-bold text-gray-900">{member.member_name}</div>
                  <div className="text-sm font-semibold text-gray-800">Lv.{member.level}</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-800 font-medium">HP:</span>
                    <span className="font-bold text-red-600">{member.hp}/{member.max_hp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800 font-medium">ATK:</span>
                    <span className="font-bold text-gray-900">{member.attack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800 font-medium">DEF:</span>
                    <span className="font-bold text-gray-900">{member.defense}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800 font-medium">SPD:</span>
                    <span className="font-bold text-gray-900">{member.speed}</span>
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
            onClick={() => router.push(inviteId ? `/adventure/stages?invite_id=${inviteId}&current=1` : '/adventure')}
            className="bg-white text-gray-900 px-8 py-5 rounded-full text-xl font-bold border-2 border-gray-300 hover:bg-gray-50 transition"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}
