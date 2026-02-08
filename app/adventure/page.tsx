'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';
import { calculateLevelUp } from '@/utils/levelup';

export default function AdventurePage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [party, setParty] = useState<(Member | null)[]>([null, null, null]);
  const [currentStage, setCurrentStage] = useState(1);
  const [isOwner, setIsOwner] = useState(false);
  const [fusionMode, setFusionMode] = useState(false);
  const [baseMember, setBaseMember] = useState<Member | null>(null);
  const [materialMembers, setMaterialMembers] = useState<Member[]>([]);
  const router = useRouter();

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

    // オーナー以外はHSTを非表示
    const filteredMembers = ownerStatus 
      ? (membersData || []) 
      : (membersData || []).filter(m => m.rarity !== 'HST');
    
    setMembers(filteredMembers);

    // 進行状況の設定
    if (progressResult.data) {
      setCurrentStage(progressResult.data.current_stage);
    } else {
      // 初回作成（非同期で実行、ロードをブロックしない）
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

    // ステージ選択画面へ
    const partyIds = filledParty.map(m => m?.id).filter(id => id !== undefined).join(',');
    if (partyIds.length === 0) {
      alert('パーティにメンバーを追加してください！');
      return;
    }
    router.push(`/adventure/stages?party=${partyIds}&current=${currentStage}`);
  }

  async function toggleLock(member: Member) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newLocked = !member.locked;
    const { error } = await supabase
      .from('user_members')
      .update({ locked: newLocked })
      .eq('id', member.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('ロック更新エラー:', error);
      return;
    }

    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, locked: newLocked } : m));
    if (newLocked) {
      if (baseMember?.id === member.id) setBaseMember(null);
      setMaterialMembers(prev => prev.filter(m => m.id !== member.id));
    } else {
      if (baseMember?.id === member.id) setBaseMember(prev => prev ? { ...prev, locked: false } : null);
      setMaterialMembers(prev => prev.map(m => m.id === member.id ? { ...m, locked: false } : m));
    }
  }

  // 合成実行
  async function executeFusion() {
    if (!baseMember || materialMembers.length === 0) return;
    if (baseMember.locked) {
      alert('ロック中のメンバーは合成に使えません');
      return;
    }
    if (materialMembers.some(m => m.locked)) {
      alert('ロック中のメンバーは素材に使えません');
      return;
    }

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
            {fusionMode ? '🔮 合成強化' : 'パーティ編成'}
          </h2>
          
          {fusionMode ? (
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
                    <div className="border-4 border-dashed border-orange-500/30 rounded-xl p-6 text-center text-gray-300 bg-gray-800/50">
                      <div className="text-4xl mb-2">➕</div>
                      <div>ベースメンバーを選択</div>
                    </div>
                  )}
                </div>

                {/* 素材メンバー選択 */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-2 text-white">
                    素材メンバー（最大5体）: {materialMembers.length}/5
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, index) => {
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
                            <div className="border-2 border-dashed border-gray-600 rounded-lg p-3 text-center text-gray-400 min-h-[100px] flex items-center justify-center bg-gray-800/30">
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
                    className="border-4 border-dashed border-orange-500/30 rounded-xl p-4 min-h-[300px] flex items-center justify-center bg-gray-800/50"
                  >
                    {member ? (
                      <MemberCard
                        member={member}
                        onClick={() => addToParty(member)}
                        selected={true}
                        showStats={false}
                      />
                    ) : (
                      <div className="text-gray-300 text-center">
                        <div className="text-4xl mb-2">➕</div>
                        <div className="text-sm">メンバーを選択</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={startAdventure}
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
                  onClick={() => router.push('/adventure/exp-stage')}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-10 py-4 rounded-lg text-xl font-bold shadow-lg shadow-emerald-500/30 transition hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/40"
                >
                  📚 経験値アップ
                </button>
                <button
                  onClick={() => {
                    setFusionMode(true);
                    setBaseMember(null);
                    setMaterialMembers([]);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:from-purple-600 hover:to-pink-600 transition shadow-lg"
                >
                  🔮 合成強化
                </button>
                <button
                  onClick={() => router.push('/adventure/equip')}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:from-amber-700 hover:to-orange-700 transition shadow-lg"
                >
                  ⚔️ 装備
                </button>
                <button
                  onClick={() => router.push('/adventure/collection')}
                  className="bg-gray-800 text-orange-500 border-2 border-orange-500 px-8 py-4 rounded-lg text-xl font-bold hover:bg-gray-700 transition"
                >
                  コレクション
                </button>
              </div>
            </>
          )}
        </div>

        {/* メンバー一覧 */}
        <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 shadow-2xl shadow-orange-500/10">
          <h2 className="text-2xl font-bold mb-4 text-white">
            {fusionMode ? 'メンバーを選択' : `所持メンバー (${members.length})`}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(member => {
              if (fusionMode) {
                // 合成モードの場合（ロック中は選択不可）
                const isBase = baseMember?.id === member.id;
                const isMaterial = materialMembers.some(m => m.id === member.id);
                const materialIndex = materialMembers.findIndex(m => m.id === member.id);
                const isLocked = member.locked === true;
                
                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      if (isLocked) return;
                      if (isBase) {
                        setBaseMember(null);
                      } else if (isMaterial) {
                        setMaterialMembers(prev => prev.filter((_, i) => i !== materialIndex));
                      } else {
                        if (!baseMember) {
                          setBaseMember(member);
                        } else if (materialMembers.length < 5) {
                          setMaterialMembers(prev => [...prev, member]);
                        } else {
                          alert('素材メンバーは最大5体までです');
                        }
                      }
                    }}
                    className={isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                  >
                    <MemberCard
                      member={member}
                      selected={isBase || isMaterial}
                      showStats={true}
                      showLockToggle={true}
                      onLockToggle={toggleLock}
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
                  showLockToggle={true}
                  onLockToggle={toggleLock}
                />
              );
            })}
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="text-center mt-8">
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
