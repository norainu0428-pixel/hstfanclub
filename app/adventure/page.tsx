'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member, isMemberVisibleToUser } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';
import { calculateLevelUp } from '@/utils/levelup';
import { canEvolve, getEvolvedStats } from '@/utils/evolution';
import { TOWER_STAGE_START, RIEMU_EVENT_STAGES } from '@/utils/stageGenerator';

export default function AdventurePage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [currentStage, setCurrentStage] = useState(1);
  const [isOwner, setIsOwner] = useState(false);
  const [fusionMode, setFusionMode] = useState(false);
  const [evolutionMode, setEvolutionMode] = useState(false);
  const [baseMember, setBaseMember] = useState<Member | null>(null);
  const [materialMembers, setMaterialMembers] = useState<Member[]>([]);
  const [evolutionMember, setEvolutionMember] = useState<Member | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode'); // 'tower' | 'riemu_event' | null

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/');
      return;
    }

    // プロフィール、メンバー、進行状況を並列で読み込み
    const [profileResult, membersResult, progressResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_members')
        .select('*')
        .eq('user_id', user.id)
        .order('level', { ascending: false }),
      supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    const ownerStatus = profileResult.data?.role === 'owner';
    setIsOwner(ownerStatus);

    const { data: membersData, error } = membersResult;
    
    if (error) {
      console.error('メンバー取得エラー:', error);
      setLoading(false);
      return;
    }

    setMembers((membersData || []).filter(m => isMemberVisibleToUser(m.member_name, ownerStatus)));

    // 進行状況の設定
    if (progressResult.data) {
      setCurrentStage(progressResult.data.current_stage);
    } else {
      (async () => {
        try {
          await supabase
            .from('user_progress')
            .insert({ user_id: user.id, current_stage: 1 });
        } catch (err) {
          console.error('進行状況作成エラー:', err);
        }
      })();
    }

    setLoading(false);

    // HP回復は非同期で実行（ロードをブロックしない）
    if (membersData && membersData.length > 0) {
      const membersToHeal = membersData.filter(m => m.hp < m.max_hp || m.current_hp < m.max_hp);
      if (membersToHeal.length > 0) {
        // バックグラウンドで並列更新
        Promise.all(
          membersToHeal.map(member =>
            supabase
              .from('user_members')
              .update({
                hp: member.max_hp,
                current_hp: member.max_hp
              })
              .eq('id', member.id)
          )
        ).then(() => {
          console.log(`${membersToHeal.length}体のメンバーのHPを全回復しました`);
        }).catch(err => {
          console.error('HP回復エラー:', err);
        });
      }
    }
  }

  function addToParty(member: Member) {
    // すでにパーティにいるかチェック
    if (party.some(m => m?.id === member.id)) {
      // 削除
      setParty(party.map(m => m?.id === member.id ? null : m));
      return;
    }

    // 空きスロットに追加
    const emptyIndex = party.findIndex(m => m === null);
    if (emptyIndex !== -1) {
      const newParty = [...party];
      newParty[emptyIndex] = member;
      setParty(newParty);
    }
  }

  function startAdventure() {
    const filledParty = party.filter(m => m !== null);
    if (filledParty.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }

    const partyIds = filledParty.map(m => m?.id).filter(id => id !== undefined).join(',');
    if (partyIds.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }

    // 覇者の塔 or Riemuイベントモードの場合は専用ステージに直接飛ばす
    if (mode === 'tower') {
      router.push(`/adventure/stage/${TOWER_STAGE_START}?party=${partyIds}`);
      return;
    }
    if (mode === 'riemu_event') {
      const firstEventStage = RIEMU_EVENT_STAGES[0];
      router.push(`/adventure/stage/${firstEventStage}?party=${partyIds}`);
      return;
    }

    // 通常の冒険
    router.push(`/adventure/stages?party=${partyIds}&current=${currentStage}`);
  }

  // 合成実行
  async function executeFusion() {
    if (!baseMember || materialMembers.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('ログインが必要です');
      return;
    }

    try {
      // 素材メンバーから経験値を計算
      let totalExp = 0;
      const rarityExpMultiplier: { [key: string]: number } = {
        'HST': 100,
        'stary': 50,
        'legendary': 30,
        'ultra-rare': 20,
        'super-rare': 15,
        'rare': 10,
        'common': 5
      };

      for (const material of materialMembers) {
        const multiplier = rarityExpMultiplier[material.rarity] || 5;
        const expFromMaterial = material.level * multiplier;
        totalExp += expFromMaterial;
      }

      // ベースメンバーに経験値を付与してレベルアップ計算
      const { updatedMember, levelUps } = calculateLevelUp(baseMember, totalExp);

      // ベースメンバーを更新
      const { error: updateError } = await supabase
        .from('user_members')
        .update({
          level: updatedMember.level,
          experience: updatedMember.experience,
          hp: updatedMember.hp,
          max_hp: updatedMember.max_hp,
          attack: updatedMember.attack,
          defense: updatedMember.defense,
          speed: updatedMember.speed,
          current_hp: updatedMember.hp
        })
        .eq('id', baseMember.id);

      if (updateError) {
        throw new Error(`ベースメンバーの更新に失敗しました: ${updateError.message}`);
      }

      // 素材メンバーを削除
      const materialIds = materialMembers.map(m => m.id);
      const { error: deleteError } = await supabase
        .from('user_members')
        .delete()
        .in('id', materialIds);

      if (deleteError) {
        throw new Error(`素材メンバーの削除に失敗しました: ${deleteError.message}`);
      }

      // 成功メッセージ
      const levelUpText = levelUps.length > 0 
        ? `レベルアップ: Lv.${baseMember.level} → Lv.${updatedMember.level}！` 
        : '';
      alert(`合成成功！\n経験値 +${totalExp}\n${levelUpText}\n${materialMembers.length}体の素材メンバーを消費しました。`);

      // 状態をリセット
      setBaseMember(null);
      setMaterialMembers([]);
      setFusionMode(false);

      // メンバーリストを再読み込み
      await loadData();
    } catch (error) {
      console.error('合成エラー:', error);
      alert(`合成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  async function executeEvolution() {
    if (!evolutionMember) return;
    if (!canEvolve(evolutionMember)) {
      alert('このメンバーは進化できません。レベルMAXになっていて、まだ未進化である必要があります。');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('ログインが必要です');
      return;
    }

    // 進化コスト: 100万ポイント
    const EVOLUTION_COST = 1_000_000;

    try {
      // 所持ポイントを確認
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('進化用ポイント取得エラー:', profileError);
        alert('進化に必要なポイントの取得に失敗しました。時間をおいて再度お試しください。');
        return;
      }

      const currentPoints = profile?.points ?? 0;
      if (currentPoints < EVOLUTION_COST) {
        alert(`進化には ${EVOLUTION_COST.toLocaleString()} pt が必要です。\n現在の所持pt: ${currentPoints.toLocaleString()} pt`);
        return;
      }

      const evolved = getEvolvedStats(evolutionMember);
      // メンバー更新とポイント消費を順番に実行
      const { error: updateMemberError } = await supabase
        .from('user_members')
        .update({
          hp: evolved.hp,
          max_hp: evolved.max_hp,
          attack: evolved.attack,
          defense: evolved.defense,
          speed: evolved.speed,
          current_hp: evolved.hp,
          evolution_stage: 1,
          evolved_at: new Date().toISOString()
        })
        .eq('id', evolutionMember.id)
        .eq('user_id', user.id);

      if (updateMemberError) throw updateMemberError;

      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ points: currentPoints - EVOLUTION_COST })
        .eq('user_id', user.id);

      if (pointsError) throw pointsError;

      alert(`✨ 進化成功！\n${evolutionMember.member_name}が進化した！\n全ステータスが約30%アップ！\n${EVOLUTION_COST.toLocaleString()} pt を消費しました。`);
      setEvolutionMember(null);
      setEvolutionMode(false);
      await loadData();
    } catch (error) {
      console.error('進化エラー:', error);
      alert(`進化に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 text-xl">読み込み中...</div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-8 max-w-md text-center shadow-lg shadow-orange-500/10">
          <div className="text-6xl mb-4">🎰</div>
          <h1 className="text-2xl font-bold mb-4 text-white">メンバーがいません</h1>
          <p className="text-gray-300 mb-6">
            まずはガチャでメンバーを獲得しましょう！
          </p>
          <button
            onClick={() => router.push('/basic/gacha')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30"
          >
            ガチャを回す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2 text-orange-500">🗺️ HST冒険記</h1>
          <p className="text-lg text-gray-300">現在のステージ: <span className="text-orange-400 font-bold">{currentStage}</span></p>
        </div>

        {/* パーティ編成エリア */}
        <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 mb-6 shadow-2xl shadow-orange-500/10">
          <h2 className="text-2xl font-bold mb-4 text-center text-white">
            {fusionMode ? '🔮 合成強化' : evolutionMode ? '✨ 進化' : 'パーティ編成'}
          </h2>
          
          {evolutionMode ? (
            <>
              {/* 進化モード */}
              <div className="mb-6">
                <p className="text-center text-gray-300 mb-4">
                  レベルMAXのメンバーを進化できます。進化後は全ステータスが約30%アップ！
                </p>
                {evolutionMember ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <MemberCard member={evolutionMember} showStats={true} />
                      <button
                        onClick={() => setEvolutionMember(null)}
                        className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                    {canEvolve(evolutionMember) ? (
                      <>
                        <div className="text-sm text-gray-400 text-center">
                          HP: {evolutionMember.max_hp} → {getEvolvedStats(evolutionMember).max_hp} /
                          ATK: {evolutionMember.attack} → {getEvolvedStats(evolutionMember).attack} /
                          DEF: {evolutionMember.defense} → {getEvolvedStats(evolutionMember).defense}
                        </div>
                        <button
                          onClick={executeEvolution}
                          className="px-8 py-3 rounded-lg text-lg font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 hover:from-amber-600 hover:to-yellow-600 shadow-lg"
                        >
                          ✨ 進化する！
                        </button>
                      </>
                    ) : (
                      <div className="text-amber-300 text-center">
                        {(evolutionMember.evolution_stage ?? 0) >= 1
                          ? 'すでに進化済みです'
                          : 'レベルMAXになると進化できます'}
                      </div>
                    )}
                    <button
                      onClick={() => { setEvolutionMode(false); setEvolutionMember(null); }}
                      className="text-gray-400 hover:text-white"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div className="border-4 border-dashed border-amber-500/30 rounded-xl p-6 text-center text-gray-400 bg-gray-800/50">
                    <div className="text-4xl mb-2">✨</div>
                    <div>進化するメンバーを選択（レベルMAXのみ）</div>
                  </div>
                )}
              </div>
            </>
          ) : fusionMode ? (
            <>
              {/* 合成モード */}
              <div className="mb-6">
                <p className="text-center text-gray-300 mb-4">
                  ベースメンバー1体に素材メンバー5体を合成して強化できます
                </p>
                
                {/* ベースメンバー選択 */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-2 text-white">ベースメンバー（強化されるメンバー）</h3>
                  {baseMember ? (
                    <div className="flex justify-center">
                      <div className="relative max-w-[200px]">
                        <MemberCard member={baseMember} showStats={true} />
                        <button
                          onClick={() => setBaseMember(null)}
                          className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-4 border-dashed border-orange-500/30 rounded-xl p-6 text-center text-gray-400 bg-gray-800/50">
                      <div className="text-4xl mb-2">➕</div>
                      <div>ベースメンバーを選択</div>
                    </div>
                  )}
                </div>

                {/* 素材メンバー選択 */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-2 text-white">
                    素材メンバー（最大10体）: {materialMembers.length}/10
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, index) => {
                      const material = materialMembers[index];
                      return (
                        <div key={index} className="relative">
                          {material ? (
                            <>
                              <MemberCard member={material} showStats={false} />
                              <button
                                onClick={() => {
                                  setMaterialMembers(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <div className="border-2 border-dashed border-gray-600 rounded-lg p-3 text-center text-slate-300 min-h-[100px] flex items-center justify-center bg-gray-800/30">
                              <div className="text-2xl">➕</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 合成実行ボタン */}
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={executeFusion}
                    disabled={!baseMember || materialMembers.length === 0}
                    className={`px-8 py-3 rounded-lg text-lg font-bold transition ${
                      baseMember && materialMembers.length > 0
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    🔮 合成実行！
                  </button>
                  <button
                    onClick={() => {
                      setFusionMode(false);
                      setBaseMember(null);
                      setMaterialMembers([]);
                    }}
                    className="bg-gray-700 text-white px-6 py-3 rounded-lg text-lg font-bold hover:bg-gray-600 transition"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 通常のパーティ編成 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {party.map((member, index) => (
                  <div
                    key={index}
                    className="border-4 border-dashed border-orange-500/30 rounded-xl p-4 min-h-[300px] flex flex-col items-center justify-center bg-gray-800/50"
                  >
                    {member ? (
                      <MemberCard
                        member={member}
                        onClick={() => addToParty(member)}
                        selected={true}
                        showStats={false}
                      />
                    ) : (
                      <div className="text-gray-400 text-center">
                        <div className="text-4xl mb-2">➕</div>
                        <div className="text-sm">メンバーを選択</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={() => startAdventure()}
                  disabled={party.filter(m => m !== null).length === 0}
                  className={`bg-gradient-to-r from-orange-500 to-orange-600 text-white px-12 py-4 rounded-lg text-xl font-bold shadow-lg shadow-orange-500/30 transition ${
                    party.filter(m => m !== null).length === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:scale-105 hover:shadow-xl hover:shadow-orange-500/40'
                  }`}
                >
                  冒険に出発！
                </button>
                <button
                  onClick={() => {
                    setFusionMode(true);
                    setEvolutionMode(false);
                    setBaseMember(null);
                    setMaterialMembers([]);
                    setEvolutionMember(null);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:from-purple-600 hover:to-pink-600 transition shadow-lg"
                >
                  🔮 合成強化
                </button>
                <button
                  onClick={() => {
                    setEvolutionMode(true);
                    setFusionMode(false);
                    setBaseMember(null);
                    setMaterialMembers([]);
                    setEvolutionMember(null);
                  }}
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 px-8 py-4 rounded-lg text-xl font-bold hover:from-amber-600 hover:to-yellow-600 transition shadow-lg"
                >
                  ✨ 進化
                </button>
                <button
                  onClick={() => router.push('/adventure/collection')}
                  className="bg-gray-800 text-orange-500 border-2 border-orange-500 px-8 py-4 rounded-lg text-xl font-bold hover:bg-gray-700 transition"
                >
                  コレクション
                </button>
                <button
                  onClick={() => router.push('/adventure/level-training')}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:from-blue-600 hover:to-indigo-700 transition shadow-lg"
                >
                  📘 レベルアップステージ
                </button>
              </div>
            </>
          )}
        </div>

        {/* メンバー一覧 */}
        <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
          <h2 className="text-2xl font-bold mb-4 text-white">
            {fusionMode ? 'メンバーを選択' : evolutionMode ? '進化するメンバーを選択（レベルMAXのみ）' : `所持メンバー (${members.length})`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(member => {
              if (evolutionMode) {
                const isSelected = evolutionMember?.id === member.id;
                const evolvable = canEvolve(member);
                return (
                  <div
                    key={member.id}
                    onClick={() => setEvolutionMember(member)}
                    className={`cursor-pointer ${!evolvable && !isSelected ? 'opacity-60' : ''}`}
                  >
                    <MemberCard
                      member={member}
                      selected={isSelected}
                      showStats={true}
                    />
                    {evolvable && (
                      <div className="text-center text-amber-400 text-xs mt-1">進化可能</div>
                    )}
                  </div>
                );
              }
              if (fusionMode) {
                // 合成モードの場合
                const isBase = baseMember?.id === member.id;
                const isMaterial = materialMembers.some(m => m.id === member.id);
                const materialIndex = materialMembers.findIndex(m => m.id === member.id);
                
                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      if (isBase) {
                        setBaseMember(null);
                      } else if (isMaterial) {
                        setMaterialMembers(prev => prev.filter((_, i) => i !== materialIndex));
                      } else {
                        if (!baseMember) {
                          setBaseMember(member);
                        } else if (materialMembers.length < 10) {
                          setMaterialMembers(prev => [...prev, member]);
                        } else {
                          alert('素材メンバーは最大10体までです');
                        }
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <MemberCard
                      member={member}
                      selected={isBase || isMaterial}
                      showStats={true}
                    />
                  </div>
                );
              }
              
              // 通常モードの場合
              return (
                <MemberCard
                  key={member.id}
                  member={member}
                  onClick={() => addToParty(member)}
                  selected={party.some(m => m?.id === member.id)}
                />
              );
            })}
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => router.push('/party')}
            className="bg-amber-800/50 text-amber-400 border border-amber-500 px-8 py-3 rounded-lg font-bold hover:bg-amber-800/70 transition"
          >
            🎪 パーティーモード
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-800 text-orange-500 border border-orange-500 px-8 py-3 rounded-lg font-bold hover:bg-gray-700 transition"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
