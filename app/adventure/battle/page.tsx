'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member, Enemy, LevelUpResult } from '@/types/adventure';
import { calculateLevelUp } from '@/utils/levelup';
import { getStageInfo } from '@/utils/stageGenerator';
import { updateMissionProgress } from '@/utils/missionTracker';
import { getPlateImageUrl } from '@/utils/plateImage';
import Image from 'next/image';

export default function BattlePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const stageIdParam = searchParams.get('stage') || '1';
  const stageId = parseInt(stageIdParam);
  const partyIds = searchParams.get('party')?.split(',') || [];
  
  // ステージIDが無効な場合のチェック
  if (isNaN(stageId) || stageId < 1 || stageId > 400) {
    // useEffect内でリダイレクトするため、ここでは早期リターンしない
  }

  const [party, setParty] = useState<Member[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [turn, setTurn] = useState(1);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [battleResult, setBattleResult] = useState<'victory' | 'defeat' | null>(null);
  const [rewards, setRewards] = useState({ exp: 0, points: 0 });
  const [levelUpResults, setLevelUpResults] = useState<LevelUpResult[]>([]);
  const [memberReviveStatus, setMemberReviveStatus] = useState<{ [key: string]: boolean }>({});
  const [skillCooldown, setSkillCooldown] = useState<{ [key: string]: number }>({});
  const [attackBoost, setAttackBoost] = useState<{ [key: string]: number }>({}); // 攻撃力ブースト（次の攻撃まで）
  const [defenseBoost, setDefenseBoost] = useState<{ [key: string]: number }>({}); // 防御力ブースト（次の被ダメージまで）
  const [originalHp, setOriginalHp] = useState<{ [key: string]: number }>({}); // バトル開始時のHP（復元用）
  const [loading, setLoading] = useState(true);
  const [isProcessingVictory, setIsProcessingVictory] = useState(false); // 勝利処理中のフラグ

  useEffect(() => {
    initBattle();
  }, []);

  // パーティ全滅チェック（useEffectで監視）
  useEffect(() => {
    if (loading || battleResult) return; // ロード中または既に結果が出ている場合はスキップ
    
    const aliveMembers = party.filter(m => m.hp > 0);
    if (aliveMembers.length === 0 && party.length > 0) {
      // 全滅している場合
      handleDefeat();
    }
  }, [party, loading, battleResult]);

  async function initBattle() {
    // ステージIDが無効な場合
    if (isNaN(stageId) || stageId < 1 || stageId > 400) {
      alert('無効なステージIDです');
      router.push('/adventure');
      return;
    }
    
    // パーティ読み込み
    if (partyIds.length === 0) {
      alert('パーティが選択されていません');
      router.push('/adventure');
      return;
    }
    
    const { data: partyData } = await supabase
      .from('user_members')
      .select('*')
      .in('id', partyIds);

    if (!partyData || partyData.length === 0) {
      alert('パーティメンバーが見つかりません');
      router.push('/adventure');
      return;
    }

    // current_hpを初期化（存在しない場合）
    const initializedParty = partyData.map(member => ({
      ...member,
      current_hp: member.current_hp || member.hp,
      hp: member.hp || member.max_hp // HPをmax_hpに設定（バトル開始時は全回復）
    }));
    
    // バトル開始時のHPを保存（復元用）
    const initialHp: { [key: string]: number } = {};
    initializedParty.forEach(member => {
      initialHp[member.id] = member.hp;
    });
    setOriginalHp(initialHp);
    
    setParty(initializedParty);

    // 敵読み込み（ステージに応じて）
    const stageInfo = getStageInfo(stageId);
    setEnemies(stageInfo.enemies.map(enemy => ({ ...enemy }))); // コピーを作成

    addLog(`ステージ${stageId}の戦闘が始まった！（推奨レベル: ${stageInfo.recommendedLevel}）`);
    setLoading(false);
  }

  function addLog(message: string) {
    setBattleLog(prev => [...prev, message]);
  }

  // STARYの自己蘇生チェック（自動）
  function checkAutoRevive(memberIndex: number): boolean {
    if (memberIndex < 0 || memberIndex >= party.length) return false;
    
    const member = party[memberIndex];
    if (!member) return false;
    
    if (member.skill_type === 'revive' && 
        member.hp <= 0 && 
        !memberReviveStatus[member.id]) {
      
      // 蘇生！
      const newParty = [...party];
      newParty[memberIndex].hp = Math.floor(member.max_hp * 0.5);
      setParty(newParty);
      
      // 蘇生使用済みフラグ
      setMemberReviveStatus({
        ...memberReviveStatus,
        [member.id]: true
      });
      
      addLog(`✨💫 ${member.member_emoji} ${member.member_name}が自己蘇生した！ HP: ${newParty[memberIndex].hp}`);
      
      // 蘇生後の全滅チェック
      setTimeout(() => {
        const aliveMembers = newParty.filter(m => m.hp > 0);
        if (aliveMembers.length === 0) {
          handleDefeat();
        }
      }, 100);
      
      return true;
    }
    
    return false;
  }

  // スキル使用処理
  async function useSkill(memberIndex: number, targetIndex?: number) {
    if (!isPlayerTurn) return;
    
    if (memberIndex < 0 || memberIndex >= party.length) return;
    
    const member = party[memberIndex];
    if (!member) return;
    
    if (!member.skill_type) {
      return;
    }

    if (skillCooldown[member.id] && skillCooldown[member.id] > 0) {
      alert('スキルはクールダウン中です');
      return;
    }

    // 自己蘇生スキルはHPが0でも使用可能
    if (member.hp <= 0 && member.skill_type !== 'revive') {
      alert('このメンバーは戦闘不能です');
      return;
    }

    // 自己蘇生スキルが既に使用済みの場合は使用不可
    if (member.skill_type === 'revive' && memberReviveStatus[member.id]) {
      alert('自己蘇生は既に使用済みです');
      return;
    }

    setIsPlayerTurn(false);

    const newParty = [...party];

    switch (member.skill_type) {
      case 'revive':
        // 自己蘇生（HPが0でも使用可能）
        if (member.hp <= 0) {
          newParty[memberIndex].hp = Math.floor(member.max_hp * 0.5);
          setMemberReviveStatus({
            ...memberReviveStatus,
            [member.id]: true
          });
          addLog(`✨💫 ${member.member_emoji} ${member.member_name}が自己蘇生した！ HP: ${newParty[memberIndex].hp}`);
        }
        setParty(newParty);
        break;

      case 'heal':
        // HP回復
        const healAmount = member.skill_power || 30;
        
        // targetIndexの範囲チェック
        if (targetIndex !== undefined) {
          if (targetIndex < 0 || targetIndex >= newParty.length) {
            alert('無効なターゲットです');
            setIsPlayerTurn(true);
            return;
          }
        }
        
        const target = targetIndex !== undefined ? newParty[targetIndex] : newParty[memberIndex];
        
        if (!target) {
          alert('ターゲットが見つかりません');
          setIsPlayerTurn(true);
          return;
        }
        
        if (target.hp <= 0) {
          alert('戦闘不能のメンバーは回復できません');
          setIsPlayerTurn(true);
          return;
        }
        
        if (targetIndex !== undefined) {
          newParty[targetIndex].hp = Math.min(
            newParty[targetIndex].hp + healAmount,
            newParty[targetIndex].max_hp
          );
          addLog(`💚 ${member.member_emoji} ${member.member_name}が ${target.member_name}のHPを${healAmount}回復した！`);
        } else {
          newParty[memberIndex].hp = Math.min(
            newParty[memberIndex].hp + healAmount,
            newParty[memberIndex].max_hp
          );
          addLog(`💚 ${member.member_emoji} ${member.member_name}がHPを${healAmount}回復した！`);
        }
        
        setParty(newParty);
        break;

      case 'attack_boost':
        // 攻撃力アップ（次の攻撃まで有効）
        const attackBoostAmount = member.skill_power || 20;
        setAttackBoost({
          ...attackBoost,
          [member.id]: attackBoostAmount
        });
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}の攻撃力が${attackBoostAmount}アップ！（次の攻撃まで有効）`);
        break;

      case 'defense_boost':
        // 防御力アップ（次の被ダメージまで有効）
        const defenseBoostAmount = member.skill_power || 15;
        setDefenseBoost({
          ...defenseBoost,
          [member.id]: defenseBoostAmount
        });
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}の防御力が${defenseBoostAmount}アップ！（次の被ダメージまで有効）`);
        break;

      case 'hst_power':
        // HSTパワー：強力な攻撃スキル（全敵にダメージ）
        const hstPower = member.skill_power || 100;
        const newEnemies = [...enemies];
        let totalDamage = 0;
        
        newEnemies.forEach((enemy, idx) => {
          if (enemy.hp > 0) {
            const damage = Math.floor(hstPower * (1 + member.attack / 100));
            newEnemies[idx].hp = Math.max(newEnemies[idx].hp - damage, 0);
            totalDamage += damage;
          }
        });
        
        setEnemies(newEnemies);
        addLog(`👑 ${member.member_emoji} ${member.member_name}がHSTパワーを発動！全敵に合計${totalDamage}ダメージ！`);
        
        // 敵全滅チェック
        if (newEnemies.every(e => e.hp <= 0)) {
          setTimeout(() => {
            if (!isProcessingVictory && !battleResult) {
              handleVictory();
            }
          }, 1000);
          return;
        }
        break;
    }

    // クールダウン設定（3ターン）
    setSkillCooldown({
      ...skillCooldown,
      [member.id]: 3
    });

    setTimeout(() => enemyTurn(), 1500);
  }

  function getSkillName(skillType: string | null | undefined): string {
    if (!skillType) return '';
    const names: { [key: string]: string } = {
      'heal': '回復',
      'revive': '自己蘇生',
      'attack_boost': '攻撃強化',
      'defense_boost': '防御強化',
      'hst_power': 'HSTパワー'
    };
    return names[skillType] || skillType;
  }

  async function playerAttack(memberIndex: number, enemyIndex: number) {
    if (!isPlayerTurn) return;
    
    if (memberIndex < 0 || memberIndex >= party.length) return;
    if (enemyIndex < 0 || enemyIndex >= enemies.length) return;
    
    const member = party[memberIndex];
    const enemy = enemies[enemyIndex];

    if (!member || !enemy || member.hp <= 0 || enemy.hp <= 0) return;

    setIsPlayerTurn(false);

    // ダメージ計算（攻撃力ブーストを適用）
    const attackBoostAmount = attackBoost[member.id] || 0;
    const boostedAttack = member.attack + attackBoostAmount;
    const baseDamage = boostedAttack - enemy.defense;
    const damage = Math.max(baseDamage + Math.floor(Math.random() * 10), 1);

    // 攻撃力ブーストを消費（使用後は削除）
    if (attackBoost[member.id]) {
      const newAttackBoost = { ...attackBoost };
      delete newAttackBoost[member.id];
      setAttackBoost(newAttackBoost);
    }

    // 敵のHP減少
    const newEnemies = [...enemies];
    newEnemies[enemyIndex].hp = Math.max(newEnemies[enemyIndex].hp - damage, 0);
    setEnemies(newEnemies);

    const boostText = attackBoostAmount > 0 ? `（攻撃力+${attackBoostAmount}）` : '';
    addLog(`${member.member_emoji} ${member.member_name}の攻撃${boostText}！ ${enemy.emoji} ${enemy.name}に${damage}ダメージ！`);

    // 敵全滅チェック
    if (newEnemies.every(e => e.hp <= 0)) {
      setTimeout(() => {
        if (!isProcessingVictory && !battleResult) {
          handleVictory();
        }
      }, 1000);
      return;
    }

    // プレイヤーの攻撃後の全滅チェック
    setTimeout(() => {
      const currentAliveParty = party.filter(m => m.hp > 0);
      if (currentAliveParty.length === 0) {
        handleDefeat();
        return;
      }
      // 敵のターン
      enemyTurn();
    }, 1500);
  }

  function enemyTurn() {
    const aliveEnemies = enemies.filter(e => e.hp > 0);
    const aliveParty = party.filter(m => m.hp > 0);

    if (aliveEnemies.length === 0 || aliveParty.length === 0) return;

    // 各敵の攻撃を順次処理（関数型更新で最新の状態を常に参照）
    const processEnemyAttack = (enemyIndex: number) => {
      if (enemyIndex >= aliveEnemies.length) {
        // 全ての敵の攻撃が完了
        setTimeout(() => {
          setParty(finalParty => {
            // 蘇生チェックを実行
            finalParty.forEach((member, idx) => {
              if (member.hp <= 0 && member.skill_type === 'revive' && !memberReviveStatus[member.id]) {
                checkAutoRevive(idx);
              }
            });
            
            // クールダウン減少
            setSkillCooldown(currentCooldown => {
              const newCooldown: any = {};
              Object.keys(currentCooldown).forEach(key => {
                const cd = currentCooldown[key] - 1;
                if (cd > 0) newCooldown[key] = cd;
              });
              return newCooldown;
            });
            
            // 蘇生チェックの完了を待ってから全滅チェック（useEffectが検出する）
            setTimeout(() => {
              const aliveMembers = finalParty.filter(m => m.hp > 0);
              if (aliveMembers.length === 0) {
                handleDefeat();
              } else {
                setTurn(prev => prev + 1);
                setIsPlayerTurn(true);
                setSelectedMember(null);
              }
            }, 800);
            
            return finalParty;
          });
        }, 500);
        return;
      }

      const enemy = aliveEnemies[enemyIndex];
      
      setTimeout(() => {
        // 最新のparty状態と防御力ブーストを取得
        setParty(currentParty => {
          const currentAliveParty = currentParty.filter(m => m.hp > 0);
          if (currentAliveParty.length === 0) {
            handleDefeat();
            return currentParty;
          }

          const targetIndex = Math.floor(Math.random() * currentAliveParty.length);
          const target = currentAliveParty[targetIndex];
          
          if (!target) {
            // ターゲットが見つからない場合は次の敵の攻撃を処理
            processEnemyAttack(enemyIndex + 1);
            return currentParty;
          }

          // 最新の防御力ブーストを取得してダメージ計算
          setDefenseBoost(currentDefenseBoost => {
            const defenseBoostAmount = currentDefenseBoost[target.id] || 0;
            const boostedDefense = target.defense + defenseBoostAmount;
            const baseDamage = enemy.attack - boostedDefense;
            const damage = Math.max(baseDamage + Math.floor(Math.random() * 10), 1);

            // 防御力ブーストを消費（使用後は削除）
            const newDefenseBoost = { ...currentDefenseBoost };
            if (newDefenseBoost[target.id]) {
              delete newDefenseBoost[target.id];
            }

            const boostText = defenseBoostAmount > 0 ? `（防御力+${defenseBoostAmount}で軽減）` : '';
            addLog(`${enemy.emoji} ${enemy.name}の攻撃${boostText}！ ${target.member_emoji} ${target.member_name}に${damage}ダメージ！`);

            // パーティのHPを更新
            setParty(partyState => {
              const updatedParty = partyState.map(m => 
                m.id === target.id 
                  ? { ...m, hp: Math.max(m.hp - damage, 0) }
                  : m
              );

              // STARY蘇生チェック
              const targetMemberIndex = updatedParty.findIndex(m => m.id === target.id);
              if (targetMemberIndex >= 0 && updatedParty[targetMemberIndex].hp <= 0) {
                setTimeout(() => {
                  checkAutoRevive(targetMemberIndex);
                }, 300);
              }

              // 次の敵の攻撃を処理
              processEnemyAttack(enemyIndex + 1);

              return updatedParty;
            });

            return newDefenseBoost;
          });

          return currentParty;
        });
      }, enemyIndex * 500);
    };

    // 最初の敵の攻撃を開始
    processEnemyAttack(0);
  }

  async function handleVictory() {
    // 重複実行を防止
    if (isProcessingVictory || battleResult) return;
    setIsProcessingVictory(true);
    
    setBattleResult('victory');
    
    // 報酬計算
    const totalExp = enemies.reduce((sum, e) => sum + e.experience_reward, 0);
    const totalPoints = enemies.reduce((sum, e) => sum + e.points_reward, 0);
    
    setRewards({ exp: totalExp, points: totalPoints });
    
    // ★★★ レベルアップ処理 ★★★
    const allLevelUps: LevelUpResult[] = [];
    const updatedParty = party.map(member => {
      const { updatedMember, levelUps } = calculateLevelUp(member, totalExp);
      allLevelUps.push(...levelUps);
      return updatedMember;
    });
    
    // パーティ更新
    setParty(updatedParty);
    
    // レベルアップメッセージ
    if (allLevelUps.length > 0) {
      allLevelUps.forEach(levelUp => {
        const member = updatedParty.find(m => m.id === levelUp.member_id);
        addLog(`🎉 ${member?.member_emoji} ${member?.member_name} が Lv.${levelUp.new_level} にレベルアップ！`);
        addLog(`   HP+${levelUp.stat_gains.hp} ATK+${levelUp.stat_gains.attack} DEF+${levelUp.stat_gains.defense} SPD+${levelUp.stat_gains.speed}`);
      });
    }
    
    addLog(`戦闘に勝利した！ 経験値+${totalExp} ポイント+${totalPoints}`);

    // データベース更新
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // ★ メンバーのステータスをデータベースに保存（勝利時はHPを全回復）
      for (const member of updatedParty) {
        await supabase
          .from('user_members')
          .update({
            level: member.level,
            experience: member.experience,
            hp: member.max_hp, // 勝利時はHPを全回復
            max_hp: member.max_hp,
            attack: member.attack,
            defense: member.defense,
            speed: member.speed,
            current_hp: member.max_hp // current_hpも全回復
          })
          .eq('id', member.id);
      }
      
      // ポイント付与
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && !profileError) {
        await supabase
          .from('profiles')
          .update({ points: (profile.points || 0) + totalPoints })
          .eq('user_id', user.id);
      }

      // 進行状況更新
      const { data: progress, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (progress && !progressError) {
        await supabase
          .from('user_progress')
          .update({
            current_stage: Math.max(stageId + 1, progress.current_stage),
            total_battles: (progress.total_battles || 0) + 1,
            total_victories: (progress.total_victories || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            current_stage: stageId + 1,
            total_battles: 1,
            total_victories: 1
          });
      }

      // バトルログ保存
      await supabase
        .from('battle_logs')
        .insert({
          user_id: user.id,
          stage: stageId,
          party_members: updatedParty.map(m => ({ 
            id: m.id, 
            name: m.member_name,
            level: m.level
          })),
          enemy_type: enemies[0]?.name || 'Unknown',
          result: 'victory',
          turns_taken: turn,
          experience_gained: totalExp,
          points_earned: totalPoints
        });

      // ミッション進捗更新
      await updateMissionProgress(user.id, 'battle_win', 1);
      await updateMissionProgress(user.id, 'battle_complete', 1);
      await updateMissionProgress(user.id, 'stage_clear', 1);
      
      // レベルアップが発生した場合
      if (allLevelUps.length > 0) {
        await updateMissionProgress(user.id, 'level_up', allLevelUps.length);
      }
    }
    
    // ★ レベルアップ情報をステートに保存（演出用）
    setLevelUpResults(allLevelUps);
  }

  async function handleDefeat() {
    // 重複実行を防止
    if (battleResult) return;
    
    setBattleResult('defeat');
    addLog('全滅してしまった...');

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 敗北時も全キャラクターのHPを全回復
      const restoredParty = party.map(member => ({
        ...member,
        hp: member.max_hp,
        current_hp: member.max_hp
      }));

      // データベースにHPを全回復して保存
      for (const member of restoredParty) {
        await supabase
          .from('user_members')
          .update({
            hp: member.max_hp,
            current_hp: member.max_hp
          })
          .eq('id', member.id);
      }

      const { data: progress, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (progress && !progressError) {
        await supabase
          .from('user_progress')
          .update({
            total_battles: (progress.total_battles || 0) + 1,
            total_defeats: (progress.total_defeats || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else if (!progressError) {
        await supabase
          .from('user_progress')
          .insert({
            user_id: user.id,
            current_stage: 1,
            total_battles: 1,
            total_defeats: 1
          });
      }

      await supabase
        .from('battle_logs')
        .insert({
          user_id: user.id,
          stage: stageId,
          party_members: party.map(m => ({ id: m.id, name: m.member_name })),
          enemy_type: enemies[0]?.name || 'Unknown',
          result: 'defeat',
          turns_taken: turn
        });

      // ミッション進捗更新（敗北でもバトル完了としてカウント）
      await updateMissionProgress(user.id, 'battle_complete', 1);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-2xl">戦闘準備中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-6">
          <h1 className="text-3xl font-bold">⚔️ バトル - ステージ{stageId} - ターン {turn}</h1>
          {(() => {
            const stageInfo = getStageInfo(stageId);
            const avgPartyLevel = party.length > 0 
              ? Math.round(party.reduce((sum, m) => sum + m.level, 0) / party.length)
              : 0;
            const levelDiff = avgPartyLevel - stageInfo.recommendedLevel;
            return (
              <div className="mt-2">
                <span className="text-lg opacity-90">
                  推奨レベル: {stageInfo.recommendedLevel} | 
                  パーティ平均レベル: {avgPartyLevel}
                </span>
                {levelDiff < -5 && (
                  <div className="mt-2 text-red-300 font-bold text-sm">
                    ⚠️ 推奨レベルより低いです！
                  </div>
                )}
                {levelDiff >= -5 && levelDiff <= 5 && (
                  <div className="mt-2 text-yellow-300 font-bold text-sm">
                    ✓ 推奨レベル付近です
                  </div>
                )}
                {levelDiff > 5 && (
                  <div className="mt-2 text-green-300 font-bold text-sm">
                    ✓ 推奨レベルより高いです
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* バトルフィールド */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* パーティ側 */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center text-blue-600">あなたのパーティ</h2>
            <div className="space-y-3">
              {party.map((member, index) => (
                <div
                  key={member.id}
                  onClick={() => isPlayerTurn && member.hp > 0 && setSelectedMember(index)}
                  className={`border-2 rounded-lg p-4 transition cursor-pointer ${
                    selectedMember === index ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  } ${member.hp <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {(() => {
                      const imageUrl = getPlateImageUrl(member.member_name, member.rarity || 'common');
                      return imageUrl ? (
                        <div className="w-12 h-12 flex-shrink-0">
                          <Image
                            src={imageUrl}
                            alt={member.member_name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ) : (
                        <div className="text-3xl">{member.member_emoji}</div>
                      );
                    })()}
                    <div className="flex-1">
                      <div className="font-bold text-lg text-gray-900">{member.member_name}</div>
                      <div className="text-sm text-gray-600 font-semibold">Lv.{member.level}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-700 font-semibold">ATK: {member.attack}</div>
                      <div className="text-gray-700 font-semibold">DEF: {member.defense}</div>
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>HP</span>
                      <span>{member.hp}/{member.max_hp}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-red-500 to-pink-500 h-3 rounded-full transition-all"
                        style={{ width: `${(member.hp / member.max_hp) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* スキルボタン */}
                  {member.skill_type && (member.hp > 0 || (member.skill_type === 'revive' && !memberReviveStatus[member.id])) && isPlayerTurn && (
                    <div className="mt-2">
                      {member.skill_type === 'heal' ? (
                        <div className="space-y-1">
                          {party.map((target, tIndex) => (
                            target.hp > 0 && target.hp < target.max_hp && (
                              <button
                                key={tIndex}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useSkill(index, tIndex);
                                }}
                                disabled={skillCooldown[member.id] > 0}
                                className={`w-full px-2 py-1 rounded text-xs font-bold transition ${
                                  skillCooldown[member.id] > 0
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                              >
                                {skillCooldown[member.id] > 0 
                                  ? `CT:${skillCooldown[member.id]}`
                                  : `${target.member_name}を回復`
                                }
                              </button>
                            )
                          ))}
                          {party.every(t => t.hp <= 0 || t.hp >= t.max_hp) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                useSkill(index);
                              }}
                              disabled={skillCooldown[member.id] > 0}
                              className={`w-full px-3 py-2 rounded text-sm font-bold transition ${
                                skillCooldown[member.id] > 0
                                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                  : 'bg-green-500 text-white hover:bg-green-600'
                              }`}
                            >
                              {skillCooldown[member.id] > 0 
                                ? `クールダウン: ${skillCooldown[member.id]}`
                                : '自分を回復'
                              }
                            </button>
                          )}
                        </div>
                      ) : member.skill_type === 'revive' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useSkill(index);
                          }}
                          disabled={skillCooldown[member.id] > 0 || memberReviveStatus[member.id]}
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition ${
                            skillCooldown[member.id] > 0 || memberReviveStatus[member.id]
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : member.hp <= 0
                              ? 'bg-purple-500 text-white hover:bg-purple-600'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {memberReviveStatus[member.id] 
                            ? '蘇生使用済み'
                            : skillCooldown[member.id] > 0 
                            ? `クールダウン: ${skillCooldown[member.id]}`
                            : member.hp <= 0
                            ? '✨ 自己蘇生'
                            : `${getSkillName(member.skill_type)} 使用`
                          }
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useSkill(index);
                          }}
                          disabled={skillCooldown[member.id] > 0}
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition ${
                            skillCooldown[member.id] > 0
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {skillCooldown[member.id] > 0 
                            ? `クールダウン: ${skillCooldown[member.id]}`
                            : `${getSkillName(member.skill_type)} 使用`
                          }
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* 蘇生使用済み表示 */}
                  {member.skill_type === 'revive' && memberReviveStatus[member.id] && (
                    <div className="mt-1 text-xs text-gray-500 text-center">
                      蘇生使用済み
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 敵側 */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-center text-red-600">敵</h2>
            <div className="space-y-3">
              {enemies.map((enemy, index) => (
                <div
                  key={index}
                  onClick={() => selectedMember !== null && enemy.hp > 0 && isPlayerTurn && playerAttack(selectedMember, index)}
                  className={`border-2 border-red-300 rounded-lg p-4 transition ${
                    selectedMember !== null && enemy.hp > 0 && isPlayerTurn ? 'cursor-pointer hover:border-red-500 hover:bg-red-50' : ''
                  } ${enemy.hp <= 0 ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {(() => {
                      // 敵の名前から実際の敵の種類名を抽出（例: "スライム Lv.1" -> "スライム"）
                      const enemyTypeName = enemy.name.split(' ')[0].split('（')[0];
                      // 敵の名前を小文字に変換してplateImageで検索
                      const imageUrl = getPlateImageUrl(enemyTypeName.toLowerCase(), 'common');
                      return imageUrl ? (
                        <div className="w-12 h-12 flex-shrink-0">
                          <Image
                            src={imageUrl}
                            alt={enemy.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ) : (
                        <div className="text-3xl">{enemy.emoji}</div>
                      );
                    })()}
                    <div className="flex-1">
                      <div className="font-bold text-lg text-gray-900">{enemy.name}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-700 font-semibold">ATK: {enemy.attack}</div>
                      <div className="text-gray-700 font-semibold">DEF: {enemy.defense}</div>
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>HP</span>
                      <span>{enemy.hp}/{enemy.max_hp}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all"
                        style={{ width: `${(enemy.hp / enemy.max_hp) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* バトルログ */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="text-xl font-bold mb-4">バトルログ</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
            {battleLog.length === 0 ? (
              <div className="text-gray-500">戦闘ログがここに表示されます...</div>
            ) : (
              battleLog.map((log, index) => (
                <div key={index} className="mb-1">&gt; {log}</div>
              ))
            )}
          </div>
        </div>

        {/* 結果表示 */}
        {battleResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              {battleResult === 'victory' ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-green-600 mb-2">勝利！</h2>
                    <p className="text-gray-600">ステージ{stageId}をクリアしました！</p>
                  </div>
                  
                  {/* ★ レベルアップ演出 ★ */}
                  {levelUpResults.length > 0 && (
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 mb-6 border-2 border-yellow-400">
                      <h3 className="font-bold text-lg mb-3 text-center text-yellow-700">
                        🎊 レベルアップ！
                      </h3>
                      <div className="space-y-3">
                        {levelUpResults.map((levelUp, index) => {
                          const member = party.find(m => m.id === levelUp.member_id);
                          return (
                            <div key={index} className="bg-white rounded-lg p-3 border-2 border-yellow-300">
                              <div className="flex items-center gap-2 mb-2">
                                {(() => {
                                  const imageUrl = member ? getPlateImageUrl(member.member_name, member.rarity || 'common') : null;
                                  return imageUrl ? (
                                    <div className="w-10 h-10 flex-shrink-0">
                                      <Image
                                        src={imageUrl}
                                        alt={member?.member_name || ''}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover rounded"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-2xl">{member?.member_emoji}</span>
                                  );
                                })()}
                                <div>
                                  <div className="font-bold text-lg text-gray-900">{member?.member_name}</div>
                                  <div className="text-sm text-gray-700 font-semibold">
                                    Lv.{levelUp.old_level} → <span className="text-green-600 font-bold">Lv.{levelUp.new_level}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div className="text-center bg-red-50 rounded p-1">
                                  <div className="text-gray-500">HP</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.hp}</div>
                                </div>
                                <div className="text-center bg-orange-50 rounded p-1">
                                  <div className="text-gray-500">ATK</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.attack}</div>
                                </div>
                                <div className="text-center bg-blue-50 rounded p-1">
                                  <div className="text-gray-500">DEF</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.defense}</div>
                                </div>
                                <div className="text-center bg-yellow-50 rounded p-1">
                                  <div className="text-gray-500">SPD</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.speed}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6">
                    <h3 className="font-bold text-lg mb-3">報酬</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>経験値:</span>
                        <span className="font-bold text-blue-600">+{rewards.exp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ポイント:</span>
                        <span className="font-bold text-green-600">+{rewards.points}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/adventure/stage/${stageId + 1}?party=${partyIds.join(',')}`)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
                    >
                      次のステージへ
                    </button>
                    <button
                      onClick={() => router.push('/adventure')}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300"
                    >
                      パーティ編成に戻る
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="text-8xl mb-6 animate-pulse">💀</div>
                    <h2 className="text-5xl font-bold text-red-600 mb-4 animate-bounce">GAME OVER</h2>
                    <p className="text-2xl text-gray-700 mb-2 font-semibold">全滅してしまいました...</p>
                    <p className="text-lg text-gray-500">ステージ{stageId}で敗北しました</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 mb-6 border-2 border-red-300">
                    <h3 className="font-bold text-lg mb-3 text-center text-red-700">戦闘結果</h3>
                    <div className="space-y-2 text-center">
                      <div className="text-gray-700">
                        <span className="font-semibold">ターン数:</span> {turn}
                      </div>
                      <div className="text-gray-700">
                        <span className="font-semibold">倒した敵:</span> {enemies.filter(e => e.hp <= 0).length}/{enemies.length}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/adventure/stage/${stageId}?party=${partyIds.join(',')}`)}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-lg font-bold text-lg hover:opacity-90 shadow-lg transform hover:scale-105 transition-all"
                    >
                      🔄 リトライ
                    </button>
                    <button
                      onClick={() => router.push('/adventure')}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg font-bold text-lg hover:bg-gray-300 shadow-lg transform hover:scale-105 transition-all"
                    >
                      🏠 パーティ編成に戻る
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
