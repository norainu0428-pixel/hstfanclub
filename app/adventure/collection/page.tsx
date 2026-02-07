'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Member } from '@/types/adventure';
import MemberCard from '@/components/adventure/MemberCard';
import { calculateLevelUp } from '@/utils/levelup';

export default function CollectionPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [sortBy, setSortBy] = useState<'level' | 'rarity' | 'obtained'>('level');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [isOwner, setIsOwner] = useState(false);
  const [fusionMode, setFusionMode] = useState(false);
  const [baseMember, setBaseMember] = useState<Member | null>(null);
  const [materialMembers, setMaterialMembers] = useState<Member[]>([]);
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [sortBy, filterRarity]);

  async function initialize() {
    await checkOwner();
    await loadMembers();
  }

  async function checkOwner() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('プロフィール取得エラー:', profileError);
      setIsOwner(false);
      return false;
    }

    const ownerStatus = profile?.role === 'owner';
    console.log('オーナーチェック:', { user_id: user.id, role: profile?.role, isOwner: ownerStatus });
    setIsOwner(ownerStatus);
    return ownerStatus;
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

  async function loadMembers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // オーナーチェックを再度実行（確実に最新の状態を取得）
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('プロフィール取得エラー:', profileError);
    }
    
    const currentIsOwner = profile?.role === 'owner';
    console.log('メンバー読み込み開始:', { user_id: user.id, isOwner: currentIsOwner });

    let query = supabase
      .from('user_members')
      .select('*')
      .eq('user_id', user.id);

    // フィルター
    if (filterRarity !== 'all') {
      query = query.eq('rarity', filterRarity);
    }

    // ソート
    if (sortBy === 'level') {
      query = query.order('level', { ascending: false });
    } else if (sortBy === 'rarity') {
      // レアリティ順は手動でソート
      const { data, error } = await query;
      console.log('メンバー取得結果（レアリティ順）:', { data, error, count: data?.length });
      
      if (error) {
        console.error('メンバー取得エラー:', error);
        return;
      }

      const rarityOrder: { [key: string]: number } = {
        'HST': -1,
        'stary': 0,
        'legendary': 1,
        'ultra-rare': 2,
        'super-rare': 3,
        'rare': 4,
        'common': 5
      };
      const sorted = (data || []).sort((a, b) => {
        const orderA = rarityOrder[a.rarity] ?? 999;
        const orderB = rarityOrder[b.rarity] ?? 999;
        return orderA - orderB;
      });
      
      // HSTメンバーを確認
      const hstMembers = sorted.filter(m => m.rarity === 'HST');
      console.log('HSTメンバー:', hstMembers);
      console.log('フィルタリング前のメンバー数:', sorted.length);
      
      // オーナー以外はHSTを非表示
      const filteredData = currentIsOwner ? sorted : sorted.filter(m => m.rarity !== 'HST');
      console.log('フィルタリング後のメンバー数:', filteredData.length);
      console.log('isOwner:', currentIsOwner);
      
      setMembers(filteredData);

      // 全員のHPを全回復（HPがmax_hp未満のメンバーのみ更新、並列処理）
      if (sorted && sorted.length > 0) {
        const membersToHeal = sorted.filter(m => m.hp < m.max_hp || m.current_hp < m.max_hp);
        if (membersToHeal.length > 0) {
          // 並列で更新
          await Promise.all(
            membersToHeal.map(member =>
              supabase
                .from('user_members')
                .update({
                  hp: member.max_hp,
                  current_hp: member.max_hp
                })
                .eq('id', member.id)
            )
          );
          console.log(`${membersToHeal.length}体のメンバーのHPを全回復しました（レアリティ順）`);
        }
      }
      return;
    } else {
      query = query.order('obtained_at', { ascending: false });
    }

    const { data, error } = await query;
    console.log('メンバー取得結果:', { data, error, count: data?.length });
    
    if (error) {
      console.error('メンバー取得エラー:', error);
      return;
    }

    // HSTメンバーを確認
    const hstMembers = (data || []).filter(m => m.rarity === 'HST');
    console.log('HSTメンバー:', hstMembers);
    console.log('フィルタリング前のメンバー数:', (data || []).length);
    
    // オーナー以外はHSTを非表示
    const filteredData = currentIsOwner ? (data || []) : (data || []).filter(m => m.rarity !== 'HST');
    console.log('フィルタリング後のメンバー数:', filteredData.length);
    console.log('isOwner:', currentIsOwner);
    
    setMembers(filteredData);

    // 全員のHPを全回復（HPがmax_hp未満のメンバーのみ更新、並列処理）
    if (data && data.length > 0) {
      const membersToHeal = data.filter(m => m.hp < m.max_hp || m.current_hp < m.max_hp);
      if (membersToHeal.length > 0) {
        // 並列で更新
        await Promise.all(
          membersToHeal.map(member =>
            supabase
              .from('user_members')
              .update({
                hp: member.max_hp,
                current_hp: member.max_hp
              })
              .eq('id', member.id)
          )
        );
        console.log(`${membersToHeal.length}体のメンバーのHPを全回復しました`);
      }
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
    if (!user) return;

    // 素材メンバーから経験値を計算
    // レベルとレアリティに基づいて経験値を付与
    let totalExp = 0;
    for (const material of materialMembers) {
      // 素材のレベルとレアリティに応じた経験値
      const rarityExpMultiplier: { [key: string]: number } = {
        'HST': 100,
        'stary': 50,
        'legendary': 30,
        'ultra-rare': 20,
        'super-rare': 15,
        'rare': 10,
        'common': 5
      };
      const multiplier = rarityExpMultiplier[material.rarity] || 5;
      const expFromMaterial = material.level * multiplier;
      totalExp += expFromMaterial;
    }

    try {
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
          current_hp: updatedMember.hp // HPも更新
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

      // メンバーリストを再読み込み
      await loadMembers();
    } catch (error) {
      console.error('合成エラー:', error);
      alert(`合成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }

  const rarityCount = {
    HST: members.filter(m => m.rarity === 'HST').length,
    stary: members.filter(m => m.rarity === 'stary').length,
    legendary: members.filter(m => m.rarity === 'legendary').length,
    'ultra-rare': members.filter(m => m.rarity === 'ultra-rare').length,
    'super-rare': members.filter(m => m.rarity === 'super-rare').length,
    rare: members.filter(m => m.rarity === 'rare').length,
    common: members.filter(m => m.rarity === 'common').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-600 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">📚 メンバーコレクション</h1>
          <p className="text-lg opacity-90">所持メンバー: {members.length}体</p>
          
          {/* モード切り替え */}
          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={() => {
                setFusionMode(false);
                setBaseMember(null);
                setMaterialMembers([]);
              }}
              className={`px-6 py-2 rounded-lg font-bold transition ${
                !fusionMode
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              閲覧モード
            </button>
            <button
              onClick={() => {
                setFusionMode(true);
                setBaseMember(null);
                setMaterialMembers([]);
              }}
              className={`px-6 py-2 rounded-lg font-bold transition ${
                fusionMode
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              🔮 合成モード
            </button>
          </div>
        </div>

        {/* 統計 */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4">レアリティ別所持数</h2>
          <div className={`grid grid-cols-2 md:grid-cols-${isOwner ? '7' : '6'} gap-3`}>
            {isOwner && (
              <div className="bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 text-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{rarityCount.HST}</div>
                <div className="text-xs">👑 HST</div>
              </div>
            )}
            <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount.stary}</div>
              <div className="text-xs">STARY</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount.legendary}</div>
              <div className="text-xs">レジェンド</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount['ultra-rare']}</div>
              <div className="text-xs">ウルトラレア</div>
            </div>
            <div className="bg-purple-500 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount['super-rare']}</div>
              <div className="text-xs">スーパーレア</div>
            </div>
            <div className="bg-blue-500 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount.rare}</div>
              <div className="text-xs">レア</div>
            </div>
            <div className="bg-gray-400 text-white rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{rarityCount.common}</div>
              <div className="text-xs">コモン</div>
            </div>
          </div>
        </div>

        {/* フィルター・ソート */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-bold mb-2">並び替え</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'level' | 'rarity' | 'obtained')}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="level">レベル順</option>
                <option value="rarity">レアリティ順</option>
                <option value="obtained">獲得順</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-bold mb-2">レアリティ</label>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="all">すべて</option>
                {isOwner && <option value="HST">👑 HST</option>}
                <option value="stary">STARY</option>
                <option value="legendary">レジェンド</option>
                <option value="ultra-rare">ウルトラレア</option>
                <option value="super-rare">スーパーレア</option>
                <option value="rare">レア</option>
                <option value="common">コモン</option>
              </select>
            </div>
          </div>
        </div>

        {/* 合成モード */}
        {fusionMode && (
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-center">🔮 メンバー合成</h2>
            <p className="text-center text-gray-600 mb-6">
              ベースメンバー1体に素材メンバー5体を合成して強化できます
            </p>
            
            {/* ベースメンバー選択 */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">ベースメンバー（強化されるメンバー）</h3>
              {baseMember ? (
                <div className="flex justify-center">
                  <div className="relative">
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
                <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400">
                  <div className="text-4xl mb-2">➕</div>
                  <div>ベースメンバーを選択</div>
                </div>
              )}
            </div>

            {/* 素材メンバー選択 */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3">
                素材メンバー（最大5体）: {materialMembers.length}/5
              </h3>
              <div className="grid grid-cols-5 gap-3">
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
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-400 min-h-[120px] flex items-center justify-center">
                          <div className="text-2xl">➕</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 合成実行ボタン */}
            <div className="text-center">
              <button
                onClick={async () => {
                  if (!baseMember) {
                    alert('ベースメンバーを選択してください');
                    return;
                  }
                  if (materialMembers.length === 0) {
                    alert('素材メンバーを1体以上選択してください');
                    return;
                  }
                  if (materialMembers.length > 5) {
                    alert('素材メンバーは最大5体までです');
                    return;
                  }
                  
                  // ベースメンバーが素材に含まれていないかチェック
                  if (materialMembers.some(m => m.id === baseMember.id)) {
                    alert('ベースメンバーは素材に含められません');
                    return;
                  }

                  await executeFusion();
                }}
                disabled={!baseMember || materialMembers.length === 0}
                className={`px-8 py-4 rounded-lg text-xl font-bold transition ${
                  baseMember && materialMembers.length > 0
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                🔮 合成実行！
              </button>
            </div>
          </div>
        )}

        {/* メンバー一覧 */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-4">
            {fusionMode ? 'メンバーを選択' : '所持メンバー'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(member => {
              // 合成モードの場合、クリックで選択（ロック中は選択不可）
              if (fusionMode) {
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
                    className={`${isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                  >
                    <MemberCard
                      member={member}
                      selected={isBase || isMaterial}
                      showStats={!fusionMode}
                      showLockToggle={true}
                      onLockToggle={toggleLock}
                    />
                  </div>
                );
              }
              
              return (
                <MemberCard
                  key={member.id}
                  member={member}
                  showLockToggle={true}
                  onLockToggle={toggleLock}
                />
              );
            })}
          </div>
          {members.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              メンバーがいません
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/adventure')}
            className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            冒険に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
