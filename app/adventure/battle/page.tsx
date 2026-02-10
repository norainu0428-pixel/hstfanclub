'use client';
/**
 * 冒険バトル
 * 実装メモ:
 * - オートバトル: isAutoMode でプレイヤーターン時に自動で通常攻撃（1体目→敵1体目）。ヘッダーにオートON/OFFボタン。
 * - 装備ボーナス: initBattle で member_equipment → user_equipment → equipment_definitions を取得し、
 *   HP/ATK/DEF/SPD を加算した party で戦闘開始。
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member, Enemy, LevelUpResult } from '@/types/adventure';
import { calculateLevelUp } from '@/utils/levelup';
import { getStageInfo, isExtraStage, EXTRA_STAGE_END, isTowerStage, getTowerRewardByStage, TOWER_STAGE_START, TOWER_STAGE_END, isRiemuEventStage, RIEMU_EVENT_STAGES } from '@/utils/stageGenerator';
import { getSkillName, SKILLS_NEED_ENEMY_TARGET, SKILLS_NEED_ALLY_TARGET } from '@/utils/skills';
import { updateMissionProgress } from '@/utils/missionTracker';
import { getPlateImageUrl } from '@/utils/plateImage';
import { getTabSessionManager } from '@/utils/tabSession';
import Image from 'next/image';

export default function BattlePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const stageIdParam = searchParams.get('stage') || '1';
  const stageId = parseInt(stageIdParam);
  const partyIds = searchParams.get('party')?.split(',').filter(Boolean) || [];
  const inviteId = searchParams.get('invite_id') || '';
  const mineIds = searchParams.get('mine')?.split(',').filter(Boolean) || [];
  const partyStageId = searchParams.get('party_stage_id') || ''; // パーティーモード用（冒険とは別）

  const [party, setParty] = useState<Member[]>([]);
  const [partyStageInfo, setPartyStageInfo] = useState<{ order: number; recommendedLevel: number; expReward: number; pointsReward: number } | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [turn, setTurn] = useState(1);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [pendingEnemyTargetMember, setPendingEnemyTargetMember] = useState<number | null>(null);
  const [battleResult, setBattleResult] = useState<'victory' | 'defeat' | null>(null);
  const [rewards, setRewards] = useState({ exp: 0, points: 0 });
  const [droppedWeapon, setDroppedWeapon] = useState<string | null>(null);
  const [levelUpResults, setLevelUpResults] = useState<LevelUpResult[]>([]);
  const [memberReviveStatus, setMemberReviveStatus] = useState<{ [key: string]: boolean }>({});
  const [skillCooldown, setSkillCooldown] = useState<{ [key: string]: number }>({});
  const [attackBoost, setAttackBoost] = useState<{ [key: string]: number }>({}); // 攻撃力ブースト（次の攻撃まで）
  const [defenseBoost, setDefenseBoost] = useState<{ [key: string]: number }>({}); // 防御力ブースト（次の被ダメージまで）
  const [barrier, setBarrier] = useState<{ [key: string]: number }>({}); // ダメージ吸収
  const [regen, setRegen] = useState<{ [key: string]: { amount: number; turns: number } }>({}); // 再生
  const [enemyPoison, setEnemyPoison] = useState<{ [key: string]: { damage: number; turns: number } }>({});
  const [enemyParalyze, setEnemyParalyze] = useState<{ [key: string]: number }>({});
  const [enemyAtkDown, setEnemyAtkDown] = useState<{ [key: string]: { amount: number; turns: number } }>({});
  const [enemyDefDown, setEnemyDefDown] = useState<{ [key: string]: { amount: number; turns: number } }>({});
  const [timeStop, setTimeStop] = useState(false);
  const [originalHp, setOriginalHp] = useState<{ [key: string]: number }>({}); // バトル開始時のHP（復元用）
  const [loading, setLoading] = useState(true);
  const [isProcessingVictory, setIsProcessingVictory] = useState(false); // 勝利処理中のフラグ
  const [isAutoMode, setIsAutoMode] = useState(false); // オートバトル
  const [isBlockedByOtherTab, setIsBlockedByOtherTab] = useState(false); // 他のタブで実行中のフラグ
  const barrierRef = useRef<{ [key: string]: number }>({});
  const tabSessionRef = useRef<ReturnType<typeof getTabSessionManager> | null>(null);

  useEffect(() => {
    barrierRef.current = barrier;
  }, [barrier]);

  // タブセッション管理の初期化
  useEffect(() => {
    const tabSession = getTabSessionManager();
    tabSessionRef.current = tabSession;

    // 他のタブがバトルを開始した場合のリスナー
    const unsubscribe = tabSession.onMessage('battle_start', async (message) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && message.userId === user.id && message.stageId === stageId) {
        // 同じユーザーが同じステージのバトルを開始した場合
        // ただし、このタブが先に開始した場合は無視
        if (message.sessionId !== tabSession.getSessionId() && !battleResult && !loading) {
          setIsBlockedByOtherTab(true);
          addLog('⚠️ 他のタブで同じバトルが実行中です。このタブでの操作は無効になります。');
        }
      }
    });

    return () => {
      unsubscribe();
      // バトルが終了していない場合でも、ページを離れる際にセッションをクリア
      (async () => {
        if (tabSessionRef.current) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            tabSessionRef.current.endBattle(user.id, stageId);
          }
        }
      })();
    };
  }, [stageId, battleResult, loading]);

  useEffect(() => { initBattle(); }, []);

  // 週の開始日を YYYY-MM-DD 文字列で返す（ローカルタイム基準、月曜始まり）
  function getCurrentWeekStartDate(): string {
    const now = new Date();
    const day = now.getDay(); // 0:日曜〜6:土曜
    const diffToMonday = (day === 0 ? -6 : 1 - day); // 月曜を週の開始とする
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
  }

  // パーティモード時: 解散をリアルタイム検知して即リダイレクト
  useEffect(() => {
    if (!inviteId || !partyStageId) return;
    const channel = supabase
      .channel(`party-invite-battle:${inviteId}`)
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
  }, [inviteId, partyStageId, router]);

  // オートバトル: プレイヤーターン時に自動で通常攻撃
  useEffect(() => {
    if (!isPlayerTurn || !isAutoMode || battleResult || loading || party.length === 0) return;
    // 生存メンバーの中から「攻撃力が一番高いメンバー」を選ぶ
    const memberIdx = party.reduce((bestIdx, m, idx) => {
      if (m.hp <= 0) return bestIdx;
      if (bestIdx === -1) return idx;
      const best = party[bestIdx];
      return m.attack > (best.attack ?? 0) ? idx : bestIdx;
    }, -1 as number);
    const enemyIdx = enemies.findIndex(e => e.hp > 0);
    if (memberIdx < 0 || enemyIdx < 0) return;
    const t = setTimeout(() => {
      playerAttack(memberIdx, enemyIdx);
    }, 600);
    return () => clearTimeout(t);
  }, [isPlayerTurn, isAutoMode, battleResult, loading, party, enemies]);

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
    if (
      !partyStageId &&
      (isNaN(stageId) ||
        stageId < 1 ||
        (!isExtraStage(stageId) && !isTowerStage(stageId) && !isRiemuEventStage(stageId) && stageId > 400))
    ) {
      alert('無効なステージIDです');
      router.push(isTowerStage(stageId) ? '/adventure/tower' : isRiemuEventStage(stageId) ? '/adventure/riemu-event' : '/adventure');
      return;
    }

    // 覇者の塔: 一度クリア済みなら再挑戦不可
    if (isTowerStage(stageId)) {
      const floor = stageId - TOWER_STAGE_START + 1;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('ログインが必要です');
        router.push('/');
        return;
      }
      const { data: towerClear } = await supabase
        .from('tower_clears')
        .select('id')
        .eq('user_id', user.id)
        .eq('floor', floor)
        .maybeSingle();
      if (towerClear) {
        alert(`覇者の塔 第${floor}階はすでにクリア済みです。再挑戦はできません。`);
        router.push('/adventure/tower');
        return;
      }
    }

    // HST Riemu イベントステージ: クリア済みなら再挑戦不可
    if (isRiemuEventStage(stageId)) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('ログインが必要です');
        router.push('/');
        return;
      }
      const { data: cleared } = await supabase
        .from('riemu_event_clears')
        .select('id')
        .eq('user_id', user.id)
        .eq('stage', stageId)
        .maybeSingle();
      if (cleared) {
        alert('この HST Riemu イベントステージはすでにクリア済みです。もう一度クリアすることはできません。');
        router.push('/adventure/riemu-event');
        return;
      }
    }

    // タブセッションチェック: 他のタブが同じバトルを実行中か確認
    const { data: { user } } = await supabase.auth.getUser();
    if (user && tabSessionRef.current) {
      const canStart = tabSessionRef.current.startBattle(user.id, stageId);
      if (!canStart) {
        setIsBlockedByOtherTab(true);
        setLoading(false);
        alert('⚠️ 他のタブで同じバトルが実行中です。\n複数のタブで同じバトルを同時に実行することはできません。\n他のタブを閉じてから再度お試しください。');
        if (isTowerStage(stageId)) {
          router.push('/adventure/tower');
        } else if (isRiemuEventStage(stageId)) {
          router.push('/adventure/riemu-event');
        } else {
          router.push('/adventure');
        }
        return;
      }
    }
    
    let initializedParty: Member[];

    if (inviteId) {
      const { data: invite, error: invErr } = await supabase
        .from('adventure_invites')
        .select('host_id, friend_id, host_party_ids, friend_party_snapshot, status')
        .eq('id', inviteId)
        .single();
      if (invErr || !invite) {
        alert('招待の取得に失敗しました');
        router.push(partyStageId ? '/party' : '/adventure');
        return;
      }
      if (invite.status === 'cancelled') {
        setLoading(false);
        router.push('/party?lobby_disbanded=1');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const isHost = user?.id === invite.host_id;
      const isFriend = user?.id === invite.friend_id;
      if (!user || (!isHost && !isFriend)) {
        alert('このバトルに参加する権限がありません');
        router.push(partyStageId ? '/party' : '/adventure');
        return;
      }
      const hostIds = (invite.host_party_ids || []).filter(Boolean);
      const snapshot = (invite.friend_party_snapshot || []) as Partial<Member>[];
      const { data: hostData } = await supabase
        .from('user_members')
        .select('*')
        .in('id', hostIds);
      const hostMembers = (hostData || []).map(m => ({
        ...m,
        current_hp: m.current_hp ?? m.hp,
        hp: m.hp ?? m.max_hp
      }));
      const friendMembers = snapshot.map(m => ({
        ...m,
        id: m.id!,
        current_hp: m.hp ?? m.max_hp,
        hp: m.hp ?? m.max_hp
      } as Member));
      initializedParty = [...hostMembers, ...friendMembers] as Member[];
    } else {
      if (partyIds.length === 0) {
        alert('パーティが選択されていません');
        if (partyStageId) {
          router.push('/party');
        } else if (isTowerStage(stageId)) {
          router.push('/adventure/tower');
        } else if (isRiemuEventStage(stageId)) {
          router.push('/adventure/riemu-event');
        } else {
          router.push('/adventure');
        }
        return;
      }
      const { data: partyData } = await supabase
        .from('user_members')
        .select('*')
        .in('id', partyIds);
      if (!partyData || partyData.length === 0) {
        alert('パーティメンバーが見つかりません');
        if (isTowerStage(stageId)) {
          router.push('/adventure/tower');
        } else if (isRiemuEventStage(stageId)) {
          router.push('/adventure/riemu-event');
        } else {
          router.push('/adventure');
        }
        return;
      }
      initializedParty = partyData.map(member => ({
        ...member,
        current_hp: member.current_hp || member.hp,
        hp: member.hp || member.max_hp
      }));
    }

    // 装備機能廃止に伴い、装備ボーナスは適用しない
    const partyWithEquip: Member[] = initializedParty;
    
    const initialHp: { [key: string]: number } = {};
    partyWithEquip.forEach(member => {
      initialHp[member.id] = member.hp;
    });
    setOriginalHp(initialHp);
    setParty(partyWithEquip);

    if (partyStageId) {
      // パーティーモード: party_stages から敵データを取得
      const { data: partyStage, error: psErr } = await supabase
        .from('party_stages')
        .select('stage_order, name, recommended_level, enemies, exp_reward, points_reward')
        .eq('id', partyStageId)
        .eq('is_active', true)
        .single();
      if (psErr || !partyStage) {
        alert('パーティーステージの取得に失敗しました');
        router.push('/party/stages');
        setLoading(false);
        return;
      }
      const enemyList = (partyStage.enemies || []) as Enemy[];
      setEnemies(enemyList.map(e => ({ ...e })));
      setPartyStageInfo({
        order: partyStage.stage_order ?? 0,
        recommendedLevel: partyStage.recommended_level ?? 1,
        expReward: partyStage.exp_reward ?? 0,
        pointsReward: partyStage.points_reward ?? 0
      });
      setRewards({ exp: partyStage.exp_reward ?? 0, points: partyStage.points_reward ?? 0 });
      addLog(`パーティステージ「${partyStage.name}」の戦闘が始まった！（推奨レベル: ${partyStage.recommended_level}）`);
    } else {
      // 冒険モード
      const stageInfo = getStageInfo(stageId);
      setEnemies(stageInfo.enemies.map(enemy => ({ ...enemy })));
      const totalExp = stageInfo.enemies.reduce((sum, e) => sum + (e.experience_reward ?? 0), 0);
      const totalPoints = stageInfo.enemies.reduce((sum, e) => sum + (e.points_reward ?? 0), 0);
      setRewards({ exp: totalExp, points: totalPoints });
      addLog(inviteId ? `ステージ${stageId} 協力バトル開始！（推奨レベル: ${stageInfo.recommendedLevel}）` : `ステージ${stageId}の戦闘が始まった！（推奨レベル: ${stageInfo.recommendedLevel}）`);
    }
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

  const enemyKey = (e: Enemy, idx: number) => (e as { id?: string }).id || `e_${idx}`;

  // スキル使用処理
  async function useSkill(memberIndex: number, targetIndex?: number, targetEnemyIndex?: number) {
    if (!isPlayerTurn || isBlockedByOtherTab || battleResult) return;
    
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
        // HSTパワー：全体攻撃スキル（全敵にダメージ・弱体化済み）
        const hstPower = member.skill_power || 40;
        const newEnemies = [...enemies];
        let totalDamage = 0;
        // 攻撃力の効き方を抑えめに（/100だと高攻撃で膨れすぎるため /400）
        const hstMultiplier = 1 + member.attack / 400;
        
        newEnemies.forEach((enemy, idx) => {
          if (enemy.hp > 0) {
            const damage = Math.floor(hstPower * hstMultiplier);
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

      case 'all_heal':
        // 全体回復
        const allHealAmount = member.skill_power || 25;
        const healedParty = newParty.map((m, i) => {
          if (m.hp > 0 && m.hp < m.max_hp) {
            const healed = Math.min(m.hp + allHealAmount, m.max_hp);
            return { ...m, hp: healed };
          }
          return m;
        });
        setParty(healedParty);
        addLog(`💚 ${member.member_emoji} ${member.member_name}が全体回復を発動！味方全員のHPを${allHealAmount}回復！`);
        break;

      case 'power_strike':
        // 威力抜撃：敵1体に強力なダメージ（targetEnemyIndex必須）
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択してください');
          setIsPlayerTurn(true);
          return;
        }
        const targetEnemy = enemies[targetEnemyIndex];
        if (!targetEnemy || targetEnemy.hp <= 0) {
          alert('無効なターゲットです');
          setIsPlayerTurn(true);
          return;
        }
        const strikePower = (member.skill_power || 50) + member.attack;
        const strikeDamage = Math.max(strikePower - targetEnemy.defense, Math.floor(strikePower * 0.3));
        const newEnemiesAfterStrike = [...enemies];
        newEnemiesAfterStrike[targetEnemyIndex].hp = Math.max(newEnemiesAfterStrike[targetEnemyIndex].hp - strikeDamage, 0);
        setEnemies(newEnemiesAfterStrike);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の威力抜撃！ ${targetEnemy.emoji} ${targetEnemy.name}に${strikeDamage}ダメージ！`);
        if (newEnemiesAfterStrike.every(e => e.hp <= 0)) {
          setTimeout(() => {
            if (!isProcessingVictory && !battleResult) handleVictory();
          }, 1000);
          return;
        }
        break;

      case 'speed_boost':
        const speedAmount = member.skill_power || 15;
        setAttackBoost(prev => ({ ...prev, [member.id]: speedAmount }));
        addLog(`⚡ ${member.member_emoji} ${member.member_name}の素早さが${speedAmount}アップ！次の攻撃が強化される！`);
        break;

      // === 攻撃系 追加 ===
      case 'double_strike':
      case 'triple_strike':
      case 'dual_wield': {
        const hits = member.skill_type === 'triple_strike' ? 3 : 2;
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択してください'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効なターゲット'); setIsPlayerTurn(true); return; }
        const pwr = (member.skill_power || 30) + member.attack;
        let dmg = Math.max(pwr - te.defense, Math.floor(pwr * 0.2));
        dmg *= hits;
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - dmg, 0) };
        setEnemies(nes);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の${hits}連撃！ ${te.emoji} ${te.name}に${dmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'aoe_attack':
      case 'blade_storm': {
        const pwr = (member.skill_power || 40) + member.attack;
        const nes = enemies.map((e, i) => {
          if (e.hp <= 0) return e;
          const d = Math.max(Math.floor(pwr * 0.5) - e.defense, Math.floor(pwr * 0.15));
          return { ...e, hp: Math.max(e.hp - d, 0) };
        });
        setEnemies(nes);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の全体攻撃！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'pierce_attack': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const pierceDmg = Math.floor((member.skill_power || 60) + member.attack * 1.2);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - pierceDmg, 0) };
        setEnemies(nes);
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}の貫通攻撃！ ${te.emoji} ${te.name}に${pierceDmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'poison_blade':
      case 'poison': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const poiDmg = Math.max((member.skill_power || 40) + member.attack - te.defense, 10);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - poiDmg, 0) };
        setEnemies(nes);
        setEnemyPoison(prev => ({ ...prev, [enemyKey(te, targetEnemyIndex)]: { damage: Math.floor(te.max_hp * 0.05), turns: 3 } }));
        addLog(`☠️ ${member.member_emoji} ${member.member_name}の毒攻撃！ ${te.emoji} ${te.name}に${poiDmg}ダメージ＋毒！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'fire_strike':
      case 'ice_strike':
      case 'thunder_strike':
      case 'dark_strike': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const elemDmg = Math.floor((member.skill_power || 50) * 1.2) + member.attack - Math.floor(te.defense * 0.8);
        const eleNames: Record<string, string> = { fire_strike: '炎', ice_strike: '氷', thunder_strike: '雷', dark_strike: '闇' };
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - Math.max(elemDmg, 5), 0) };
        setEnemies(nes);
        addLog(`🔥 ${member.member_emoji} ${member.member_name}の${eleNames[member.skill_type!] || '属性'}攻撃！ ${te.emoji} ${te.name}に${Math.max(elemDmg, 5)}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'critical_strike': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const critDmg = Math.floor(((member.skill_power || 80) + member.attack) * 1.5) - te.defense;
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - Math.max(critDmg, 10), 0) };
        setEnemies(nes);
        addLog(`⭐ ${member.member_emoji} ${member.member_name}の必殺の一撃！ ${te.emoji} ${te.name}に${Math.max(critDmg, 10)}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'drain_attack': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const drainDmg = Math.max((member.skill_power || 40) + member.attack - te.defense, 5);
        const healAmt = Math.floor(drainDmg * 0.5);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - drainDmg, 0) };
        setEnemies(nes);
        const np = [...newParty];
        np[memberIndex] = { ...member, hp: Math.min(member.hp + healAmt, member.max_hp) };
        setParty(np);
        addLog(`🩸 ${member.member_emoji} ${member.member_name}の吸血攻撃！ ${te.emoji} ${te.name}に${drainDmg}ダメージ、自分が${healAmt}回復！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'execute': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const bonus = te.hp <= te.max_hp * 0.3 ? 2 : 1;
        const execDmg = Math.floor(((member.skill_power || 50) + member.attack) * bonus) - te.defense;
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - Math.max(execDmg, 5), 0) };
        setEnemies(nes);
        addLog(`💀 ${member.member_emoji} ${member.member_name}の弱点突き！ ${te.emoji} ${te.name}に${Math.max(execDmg, 5)}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'finish': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const finDmg = te.hp <= te.max_hp * 0.2 ? te.hp + 50 : Math.max((member.skill_power || 40) + member.attack - te.defense, 10);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: 0 };
        setEnemies(nes);
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}の追い打ち！ ${te.emoji} ${te.name}に${finDmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'poison_cloud': {
        const pwr = member.skill_power || 30;
        const poisonUpdates: { [key: string]: { damage: number; turns: number } } = {};
        const nes = enemies.map((e, i) => {
          if (e.hp <= 0) return e;
          const d = Math.max(Math.floor(pwr * 0.8), 5);
          poisonUpdates[enemyKey(e, i)] = { damage: Math.floor(e.max_hp * 0.03), turns: 2 };
          return { ...e, hp: Math.max(e.hp - d, 0) };
        });
        setEnemies(nes);
        setEnemyPoison(prev => ({ ...prev, ...poisonUpdates }));
        addLog(`☠️ ${member.member_emoji} ${member.member_name}の毒霧！全敵に毒ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'quake':
      case 'spin_attack':
      case 'explosion': {
        const pwr = (member.skill_power || 50) + member.attack;
        const nes = enemies.map(e => {
          if (e.hp <= 0) return e;
          const d = Math.max(Math.floor(pwr * 0.7) - e.defense, Math.floor(pwr * 0.2));
          return { ...e, hp: Math.max(e.hp - d, 0) };
        });
        setEnemies(nes);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の範囲攻撃！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'kamikaze': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const kDmg = Math.floor((member.skill_power || 100) * 2) - te.defense;
        const selfDmg = Math.floor(member.max_hp * 0.3);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - Math.max(kDmg, 20), 0) };
        setEnemies(nes);
        const np = [...newParty];
        np[memberIndex] = { ...member, hp: Math.max(member.hp - selfDmg, 0) };
        setParty(np);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の捨て身の一撃！ ${te.emoji} ${te.name}に${Math.max(kDmg, 20)}ダメージ！自分も${selfDmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'attack_down':
      case 'defense_down':
      case 'slow':
      case 'weaken': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const amt = member.skill_power || 15;
        const key = enemyKey(te, targetEnemyIndex);
        if (member.skill_type === 'attack_down') setEnemyAtkDown(prev => ({ ...prev, [key]: { amount: amt, turns: 2 } }));
        else if (member.skill_type === 'defense_down') setEnemyDefDown(prev => ({ ...prev, [key]: { amount: amt, turns: 2 } }));
        addLog(`📉 ${member.member_emoji} ${member.member_name}が ${te.emoji} ${te.name}を弱体化！`);
        break;
      }
      case 'paralyze':
      case 'sleep':
      case 'freeze': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        setEnemyParalyze(prev => ({ ...prev, [enemyKey(te, targetEnemyIndex)]: 1 }));
        addLog(`❄️ ${member.member_emoji} ${member.member_name}が ${te.emoji} ${te.name}を止めた！`);
        break;
      }
      case 'insta_kill': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const chance = Math.min((member.skill_power || 5) / 100, 0.3);
        const nes = [...enemies];
        if (Math.random() < chance) {
          nes[targetEnemyIndex] = { ...te, hp: 0 };
          addLog(`💀 ${member.member_emoji} ${member.member_name}の即死！ ${te.emoji} ${te.name}を倒した！`);
        } else {
          const d = Math.max((member.skill_power || 30) + member.attack - te.defense, 5);
          nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - d, 0) };
          addLog(`💥 ${member.member_emoji} ${member.member_name}の攻撃！ ${te.emoji} ${te.name}に${d}ダメージ！`);
        }
        setEnemies(nes);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'hp_drain': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const drainAmt = Math.min(te.hp, Math.floor(te.max_hp * 0.3));
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - drainAmt, 0) };
        setEnemies(nes);
        const np = [...newParty];
        np[memberIndex] = { ...member, hp: Math.min(member.hp + drainAmt, member.max_hp) };
        setParty(np);
        addLog(`🩸 ${member.member_emoji} ${member.member_name}が ${te.emoji} ${te.name}のHPを${drainAmt}吸収！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'flash':
      case 'preemptive': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return; }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const flashDmg = Math.floor((member.skill_power || 60) * 1.3) + member.attack - Math.floor(te.defense * 0.5);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - Math.max(flashDmg, 10), 0) };
        setEnemies(nes);
        addLog(`⚡ ${member.member_emoji} ${member.member_name}の一閃！ ${te.emoji} ${te.name}に${Math.max(flashDmg, 10)}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }

      // === 回復・防御系 追加 ===
      case 'big_heal':
        const bigHealAmt = member.skill_power || 60;
        const tgt = targetIndex !== undefined && targetIndex >= 0 && targetIndex < newParty.length ? newParty[targetIndex] : newParty[memberIndex];
        if (tgt && tgt.hp > 0) {
          const ti = targetIndex ?? memberIndex;
          newParty[ti] = { ...newParty[ti], hp: Math.min(newParty[ti].hp + bigHealAmt, newParty[ti].max_hp) };
          setParty(newParty);
          addLog(`💚 ${member.member_emoji} ${member.member_name}が大回復！ ${tgt.member_name}のHPを${bigHealAmt}回復！`);
        }
        break;
      case 'regen':
      case 'regen_long':
      case 'life_spring':
        setRegen(prev => ({ ...prev, [member.id]: { amount: member.skill_power || 20, turns: member.skill_type === 'regen_long' ? 5 : 3 } }));
        addLog(`💚 ${member.member_emoji} ${member.member_name}が再生を発動！毎ターンHP回復！`);
        break;
      case 'all_defense': {
        const amt = member.skill_power || 15;
        const next: { [key: string]: number } = {};
        newParty.forEach(m => { if (m.hp > 0) next[m.id] = (defenseBoost[m.id] || 0) + amt; });
        setDefenseBoost(prev => ({ ...prev, ...next }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}が味方全員の防御をアップ！`);
        break;
      }
      case 'barrier':
        setBarrier(prev => ({ ...prev, [member.id]: member.skill_power || 50 }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}がバリアを張った！`);
        break;
      case 'iron_wall':
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + (member.skill_power || 40) }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}が鉄壁！`);
        break;
      case 'prayer':
        const prayAmt = member.skill_power || 15;
        const prayed = newParty.map(m => m.hp > 0 ? { ...m, hp: Math.min(m.hp + prayAmt, m.max_hp) } : m);
        setParty(prayed);
        addLog(`🙏 ${member.member_emoji} ${member.member_name}の祈り！味方全員が${prayAmt}回復！`);
        break;
      case 'first_aid': {
        const low = newParty.find(m => m.hp > 0 && m.hp < m.max_hp * 0.5);
        const ti = low ? newParty.indexOf(low) : memberIndex;
        const firstAidAmt = member.skill_power || 40;
        newParty[ti] = { ...newParty[ti], hp: Math.min(newParty[ti].hp + firstAidAmt, newParty[ti].max_hp) };
        setParty(newParty);
        addLog(`💚 ${member.member_emoji} ${member.member_name}の応急手当！ ${newParty[ti].member_name}を${firstAidAmt}回復！`);
        break;
      }

      // === バフ系 追加 ===
      case 'all_attack': {
        const amt = member.skill_power || 15;
        const next: { [key: string]: number } = {};
        newParty.forEach(m => { if (m.hp > 0) next[m.id] = (attackBoost[m.id] || 0) + amt; });
        setAttackBoost(prev => ({ ...prev, ...next }));
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}が味方全員の攻撃をアップ！`);
        break;
      }
      case 'quick': {
        const amt = member.skill_power || 10;
        const next: { [key: string]: number } = {};
        newParty.forEach(m => { if (m.hp > 0) next[m.id] = (attackBoost[m.id] || 0) + amt; });
        setAttackBoost(prev => ({ ...prev, ...next }));
        addLog(`⚡ ${member.member_emoji} ${member.member_name}が味方全員をクイック！`);
        break;
      }
      case 'rally':
      case 'morale': {
        const atkAmt = member.skill_power || 10;
        const defAmt = Math.floor((member.skill_power || 10) * 0.8);
        const nextAtk: { [key: string]: number } = {};
        const nextDef: { [key: string]: number } = {};
        newParty.forEach(m => {
          if (m.hp > 0) {
            nextAtk[m.id] = (attackBoost[m.id] || 0) + atkAmt;
            nextDef[m.id] = (defenseBoost[m.id] || 0) + defAmt;
          }
        });
        setAttackBoost(prev => ({ ...prev, ...nextAtk }));
        setDefenseBoost(prev => ({ ...prev, ...nextDef }));
        addLog(`📢 ${member.member_emoji} ${member.member_name}の鼓舞！味方全員が強化！`);
        break;
      }
      case 'might':
      case 'berserk':
        const mightAmt = member.skill_power || 30;
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + mightAmt }));
        if (member.skill_type === 'berserk') setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) - 10 }));
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}の剛力！攻撃力が${mightAmt}アップ！`);
        break;
      case 'fortify':
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + (member.skill_power || 25) }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}が堅陣！`);
        break;
      case 'haste':
      case 'double_turn':
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + (member.skill_power || 20) }));
        addLog(`⚡ ${member.member_emoji} ${member.member_name}が加速！`);
        break;
      case 'awaken':
      case 'last_awaken':
        const awkAmt = member.skill_power || 25;
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + awkAmt }));
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + awkAmt }));
        addLog(`✨ ${member.member_emoji} ${member.member_name}が覚醒！全ステータスアップ！`);
        break;

      // === 特殊系 ===
      case 'time_stop':
        setTimeStop(true);
        addLog(`⏰ ${member.member_emoji} ${member.member_name}が時間停止！敵のターンをスキップ！`);
        break;
      case 'counter_prep':
      case 'counter':
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 999 }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}が反撃準備！`);
        break;
      case 'reflect_shield':
      case 'damage_reflect':
        setBarrier(prev => ({ ...prev, [member.id]: (member.skill_power || 30) * 2 }));
        addLog(`🪞 ${member.member_emoji} ${member.member_name}が反射盾！`);
        break;
      case 'cheer': {
        const cheerTarget = targetIndex !== undefined && targetIndex >= 0 ? newParty[targetIndex] : newParty.find(m => m.hp > 0);
        if (cheerTarget) {
          const ci = targetIndex ?? newParty.findIndex(m => m.id === cheerTarget.id);
          setAttackBoost(prev => ({ ...prev, [cheerTarget.id]: (prev[cheerTarget.id] || 0) + (member.skill_power || 25) }));
          addLog(`📣 ${member.member_emoji} ${member.member_name}が ${cheerTarget.member_name}を応援！`);
        }
        break;
      }
      case 'miracle': {
        const healAll = member.skill_power || 50;
        const mirac = newParty.map(m => m.hp > 0 ? { ...m, hp: Math.min(m.hp + healAll, m.max_hp) } : m);
        setParty(mirac);
        addLog(`✨ ${member.member_emoji} ${member.member_name}の奇跡！味方全員が${healAll}回復！`);
        break;
      }
      case 'lucky_star': {
        const r = Math.random();
        if (r < 0.33) {
          setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 50 }));
          addLog(`🌟 ${member.member_emoji} ${member.member_name}のラッキースター！攻撃が大アップ！`);
        } else if (r < 0.66) {
          const healAmt = member.skill_power || 40;
          newParty[memberIndex] = { ...member, hp: Math.min(member.hp + healAmt, member.max_hp) };
          setParty(newParty);
          addLog(`🌟 ${member.member_emoji} ${member.member_name}のラッキースター！HP回復！`);
        } else {
          const pwr = member.skill_power || 50;
          const nes = enemies.map(e => e.hp > 0 ? { ...e, hp: Math.max(e.hp - pwr, 0) } : e);
          setEnemies(nes);
          addLog(`🌟 ${member.member_emoji} ${member.member_name}のラッキースター！全敵にダメージ！`);
          if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        }
        break;
      }
      case 'push':
      case 'restrain':
      case 'intimidate':
      case 'curse_damage': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const cDmg = Math.max((member.skill_power || 35) + member.attack - te.defense, 5);
        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...te, hp: Math.max(te.hp - cDmg, 0) };
        setEnemies(nes);
        addLog(`💥 ${member.member_emoji} ${member.member_name}の${getSkillName(member.skill_type)}！ ${te.emoji} ${te.name}に${cDmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'confusion':
      case 'silence':
      case 'shrink':
      case 'fear':
      case 'blind':
      case 'bleed':
      case 'curse': {
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択'); setIsPlayerTurn(true); return;
        }
        const te = enemies[targetEnemyIndex];
        if (!te || te.hp <= 0) { alert('無効'); setIsPlayerTurn(true); return; }
        const key = enemyKey(te, targetEnemyIndex);
        if (member.skill_type === 'bleed') {
          setEnemyPoison(prev => ({ ...prev, [key]: { damage: Math.floor(te.max_hp * 0.04), turns: 3 } }));
        } else {
          setEnemyParalyze(prev => ({ ...prev, [key]: 2 }));
        }
        addLog(`🎭 ${member.member_emoji} ${member.member_name}が ${te.emoji} ${te.name}に${getSkillName(member.skill_type)}！`);
        break;
      }
      case 'purify': {
        const pur = newParty.map(m => m.hp > 0 ? { ...m } : m);
        setParty(pur);
        setAttackBoost(prev => prev);
        setDefenseBoost(prev => prev);
        addLog(`✨ ${member.member_emoji} ${member.member_name}の浄化！味方の弱体を解除！`);
        break;
      }
      case 'fortress':
      case 'holy_guard': {
        const fAmt = member.skill_power || 40;
        const tgt = targetIndex !== undefined && targetIndex >= 0 ? newParty[targetIndex] : member;
        if (tgt && tgt.hp > 0) {
          setBarrier(prev => ({ ...prev, [tgt.id]: (prev[tgt.id] || 0) + fAmt }));
          setDefenseBoost(prev => ({ ...prev, [tgt.id]: (prev[tgt.id] || 0) + Math.floor(fAmt * 0.5) }));
          addLog(`🛡️ ${member.member_emoji} ${member.member_name}が ${tgt.member_name}を守護！`);
        }
        break;
      }
      case 'focus':
      case 'spirit':
      case 'lucky': {
        const focAmt = member.skill_power || 20;
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + focAmt }));
        addLog(`✨ ${member.member_emoji} ${member.member_name}の集中！次攻撃が強化！`);
        break;
      }
      case 'sacrifice':
      case 'last_resort': {
        const lowHpBonus = member.hp <= member.max_hp * 0.3 ? 2 : 1;
        const sacDmg = Math.floor(((member.skill_power || 80) + member.attack) * 1.5 * lowHpBonus);
        const selfDmg = member.skill_type === 'sacrifice' ? Math.floor(member.max_hp * 0.2) : 0;
        const nes = enemies.map(e => e.hp > 0 ? { ...e, hp: Math.max(e.hp - sacDmg, 0) } : e);
        setEnemies(nes);
        if (selfDmg > 0) {
          const np = [...newParty];
          np[memberIndex] = { ...member, hp: Math.max(member.hp - selfDmg, 0) };
          setParty(np);
        }
        addLog(`💀 ${member.member_emoji} ${member.member_name}の捨て身攻撃！全敵に${sacDmg}ダメージ！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'chain': {
        const chainPwr = (member.skill_power || 30) * 2;
        const nes = enemies.map(e => e.hp > 0 ? { ...e, hp: Math.max(e.hp - Math.floor(chainPwr * 0.5), 0) } : e);
        setEnemies(nes);
        addLog(`⚡ ${member.member_emoji} ${member.member_name}のチェイン！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'overheat': {
        const OHdmg = Math.floor((member.skill_power || 100) * 1.5) + member.attack;
        const nes = enemies.map(e => e.hp > 0 ? { ...e, hp: Math.max(e.hp - Math.floor(OHdmg * 0.3), 0) } : e);
        setEnemies(nes);
        const np = [...newParty];
        np[memberIndex] = { ...member, hp: Math.max(member.hp - Math.floor(member.max_hp * 0.1), 0) };
        setParty(np);
        addLog(`🔥 ${member.member_emoji} ${member.member_name}のオーバーヒート！`);
        if (nes.every(e => e.hp <= 0)) setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
        break;
      }
      case 'riemu_blessing': {
        // Riemuの加護: 敵1体に自分の攻撃力の3倍ダメージ、自分は元の攻撃力分だけ回復
        if (targetEnemyIndex === undefined || targetEnemyIndex < 0 || targetEnemyIndex >= enemies.length) {
          alert('敵を選択してください'); setIsPlayerTurn(true); return;
        }
        const targetEnemy = enemies[targetEnemyIndex];
        if (!targetEnemy || targetEnemy.hp <= 0) {
          alert('無効なターゲットです'); setIsPlayerTurn(true); return;
        }

        const baseAttack = member.attack;
        const damage = Math.max(baseAttack * 3 - targetEnemy.defense, Math.floor(baseAttack * 1.5));

        const nes = [...enemies];
        nes[targetEnemyIndex] = { ...targetEnemy, hp: Math.max(targetEnemy.hp - damage, 0) };
        setEnemies(nes);

        const healedHp = Math.min(member.hp + baseAttack, member.max_hp);
        const np = [...newParty];
        np[memberIndex] = { ...member, hp: healedHp };
        setParty(np);

        addLog(`🌟 ${member.member_emoji} ${member.member_name}のRiemuの加護！ ${targetEnemy.emoji} ${targetEnemy.name}に${damage}ダメージ、自分のHPが${baseAttack}回復！`);

        if (nes.every(e => e.hp <= 0)) {
          setTimeout(() => { if (!isProcessingVictory && !battleResult) handleVictory(); }, 1000);
          return;
        }
        break;
      }
      case 'mirage': {
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 50 }));
        addLog(`🌫️ ${member.member_emoji} ${member.member_name}がミラージュ！回避アップ！`);
        break;
      }
      case 'revenge': {
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 30 }));
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 20 }));
        addLog(`⚔️ ${member.member_emoji} ${member.member_name}のリベンジ準備！`);
        break;
      }
      case 'echo': {
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 15 }));
        addLog(`🔊 ${member.member_emoji} ${member.member_name}のエコー！`);
        break;
      }
      case 'summon':
      case 'aura': {
        const sumAmt = member.skill_power || 15;
        const next: { [key: string]: number } = {};
        newParty.forEach(m => { if (m.hp > 0) next[m.id] = (attackBoost[m.id] || 0) + sumAmt; });
        setAttackBoost(prev => ({ ...prev, ...next }));
        addLog(`✨ ${member.member_emoji} ${member.member_name}のオーラ！味方全員が強化！`);
        break;
      }
      case 'convert': {
        const cost = Math.floor(member.max_hp * 0.15);
        const gained = Math.floor(member.attack * 0.5) + (member.skill_power || 20);
        const np = [...newParty];
        // HP だけ実ステータスに反映し、攻撃力アップは一時的なバフとして扱う
        np[memberIndex] = { ...member, hp: Math.max(member.hp - cost, 0) };
        setParty(np);
        setAttackBoost(prev => ({
          ...prev,
          [member.id]: (prev[member.id] || 0) + gained
        }));
        addLog(`🔄 ${member.member_emoji} ${member.member_name}の転換！HPを消費して攻撃が一時的に${gained}アップ！`);
        break;
      }
      case 'copy': {
        setAttackBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 25 }));
        addLog(`📋 ${member.member_emoji} ${member.member_name}がスキルをコピー！`);
        break;
      }
      case 'holy_light':
      case 'revive_light': {
        const hlAmt = member.skill_power || 45;
        const hl = newParty.map(m => m.hp > 0 ? { ...m, hp: Math.min(m.hp + hlAmt, m.max_hp) } : m);
        setParty(hl);
        addLog(`✨ ${member.member_emoji} ${member.member_name}の癒しの光！味方全員回復！`);
        break;
      }
      case 'endure': {
        setDefenseBoost(prev => ({ ...prev, [member.id]: (prev[member.id] || 0) + 60 }));
        addLog(`🛡️ ${member.member_emoji} ${member.member_name}が不屈！`);
        break;
      }
      default:
        addLog(`⚠️ ${member.member_emoji} ${member.member_name}のスキル${member.skill_type}は未実装の挙動です`);
    }

    // クールダウン設定（通常3ターン / Riemuの加護は5ターン）
    const cd = member.skill_type === 'riemu_blessing' ? 5 : 3;
    setSkillCooldown({
      ...skillCooldown,
      [member.id]: cd
    });

    const usedTimeStop = member.skill_type === 'time_stop';
    setTimeout(() => enemyTurn(usedTimeStop), 1500);
  }

  async function playerAttack(memberIndex: number, enemyIndex: number) {
    if (!isPlayerTurn || isBlockedByOtherTab || battleResult) return;
    
    if (memberIndex < 0 || memberIndex >= party.length) return;
    if (enemyIndex < 0 || enemyIndex >= enemies.length) return;
    
    const member = party[memberIndex];
    const enemy = enemies[enemyIndex];

    if (!member || !enemy || member.hp <= 0 || enemy.hp <= 0) return;

    setIsPlayerTurn(false);

    // ダメージ計算（攻撃力ブースト・敵防御ダウンを適用）
    const attackBoostAmount = attackBoost[member.id] || 0;
    const boostedAttack = member.attack + attackBoostAmount;
    const eKey = enemyKey(enemy, enemyIndex);
    const defDownAmount = enemyDefDown[eKey]?.amount || 0;
    const effectiveDefense = Math.max(enemy.defense - defDownAmount, 0);
    const baseDamage = boostedAttack - effectiveDefense;
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
      enemyTurn(false);
    }, 1500);
  }

  function enemyTurn(timeStopUsed?: boolean) {
    const aliveEnemies = enemies.filter(e => e.hp > 0);
    const aliveParty = party.filter(m => m.hp > 0);

    if (aliveEnemies.length === 0 || aliveParty.length === 0) return;

    // 時間停止時は敵のターンをスキップ
    if (timeStopUsed) {
      setTimeStop(false);
      addLog('⏰ 時間停止の効果で敵のターンがスキップされた！');
      setSkillCooldown(cd => {
        const next: { [key: string]: number } = {};
        Object.keys(cd).forEach(k => { const v = cd[k] - 1; if (v > 0) next[k] = v; });
        return next;
      });
      setRegen(r => {
        const next: { [key: string]: { amount: number; turns: number } } = {};
        Object.entries(r).forEach(([k, v]) => {
          const member = party.find(m => m.id === k);
          if (member && member.hp > 0 && v.turns > 1) {
            next[k] = { ...v, turns: v.turns - 1 };
          }
        });
        return next;
      });
      setEnemyPoison(p => {
        const next: { [key: string]: { damage: number; turns: number } } = {};
        Object.entries(p).forEach(([k, v]) => {
          if (v.turns > 1) next[k] = { ...v, turns: v.turns - 1 };
        });
        return next;
      });
      setEnemyParalyze(pp => {
        const next: { [key: string]: number } = {};
        Object.entries(pp).forEach(([k, v]) => { if (v > 1) next[k] = v - 1; });
        return next;
      });
      setEnemyAtkDown(a => {
        const next: { [key: string]: { amount: number; turns: number } } = {};
        Object.entries(a).forEach(([k, v]) => { if (v.turns > 1) next[k] = { ...v, turns: v.turns - 1 }; });
        return next;
      });
      setEnemyDefDown(d => {
        const next: { [key: string]: { amount: number; turns: number } } = {};
        Object.entries(d).forEach(([k, v]) => { if (v.turns > 1) next[k] = { ...v, turns: v.turns - 1 }; });
        return next;
      });
      setTimeout(() => {
        setTurn(prev => prev + 1);
        setIsPlayerTurn(true);
        setSelectedMember(null);
        setPendingEnemyTargetMember(null);
      }, 500);
      return;
    }

    // 毒ダメージ処理（敵ターン開始時）
    let currentEnemies = [...enemies];
    const poisonEntries = Object.entries(enemyPoison);
    if (poisonEntries.length > 0) {
      const nextPoison: { [key: string]: { damage: number; turns: number } } = {};
      poisonEntries.forEach(([key, val]) => {
        const idx = currentEnemies.findIndex((e, i) => enemyKey(e, i) === key);
        if (idx >= 0 && currentEnemies[idx].hp > 0) {
          const dmg = val.damage;
          currentEnemies = currentEnemies.map((e, i) => i === idx ? { ...e, hp: Math.max(e.hp - dmg, 0) } : e);
          addLog(`☠️ 毒ダメージ！ ${currentEnemies[idx].emoji} ${currentEnemies[idx].name}に${dmg}ダメージ！`);
          if (val.turns > 1) nextPoison[key] = { ...val, turns: val.turns - 1 };
        }
      });
      setEnemies(currentEnemies);
      setEnemyPoison(prev => ({ ...prev, ...nextPoison }));
    }
    const aliveEnemiesAfterPoison = currentEnemies.filter(e => e.hp > 0);

    // 各敵の攻撃を順次処理（関数型更新で最新の状態を常に参照）
    const processEnemyAttack = (enemyIndex: number) => {
      if (enemyIndex >= aliveEnemiesAfterPoison.length) {
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
            // 敵デバフ時間減少
            setEnemyAtkDown(a => {
              const next: { [key: string]: { amount: number; turns: number } } = {};
              Object.entries(a).forEach(([k, v]) => { if (v.turns > 1) next[k] = { ...v, turns: v.turns - 1 }; });
              return next;
            });
            setEnemyDefDown(d => {
              const next: { [key: string]: { amount: number; turns: number } } = {};
              Object.entries(d).forEach(([k, v]) => { if (v.turns > 1) next[k] = { ...v, turns: v.turns - 1 }; });
              return next;
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
                setPendingEnemyTargetMember(null);
                // リジェネ処理（プレイヤーターン開始時）
                setRegen(currentRegen => {
                  const nextRegen: { [key: string]: { amount: number; turns: number } } = {};
                  const partyUpdates: { [key: string]: number } = {};
                  Object.entries(currentRegen).forEach(([memberId, reg]) => {
                    const m = finalParty.find(p => p.id === memberId);
                    if (m && m.hp > 0 && reg.turns > 0) {
                      const healAmt = Math.min(reg.amount, m.max_hp - m.hp);
                      if (healAmt > 0) partyUpdates[memberId] = m.hp + healAmt;
                      if (reg.turns > 1) nextRegen[memberId] = { ...reg, turns: reg.turns - 1 };
                    }
                  });
                  if (Object.keys(partyUpdates).length > 0) {
                    setParty(prev => prev.map(m => partyUpdates[m.id] !== undefined ? { ...m, hp: partyUpdates[m.id] } : m));
                  }
                  return nextRegen;
                });
              }
            }, 800);
            
            return finalParty;
          });
        }, 500);
        return;
      }

      const enemy = aliveEnemiesAfterPoison[enemyIndex];
      const origIdx = currentEnemies.findIndex(e => e === enemy);
      const eKey = origIdx >= 0 ? enemyKey(enemy, origIdx) : `e_${enemyIndex}`;

      // 麻痺・睡眠・凍結時はターンスキップ
      if (enemyParalyze[eKey] && enemyParalyze[eKey] > 0) {
        setEnemyParalyze(pp => {
          const next = { ...pp };
          if (next[eKey] > 1) next[eKey] = next[eKey] - 1; else delete next[eKey];
          return next;
        });
        addLog(`❄️ ${enemy.emoji} ${enemy.name}は状態異常で動けない！`);
        setTimeout(() => processEnemyAttack(enemyIndex + 1), 300);
        return;
      }

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
            processEnemyAttack(enemyIndex + 1);
            return currentParty;
          }

          // 最新の防御力ブースト・バリア・敵攻撃ダウンを取得してダメージ計算
          setDefenseBoost(currentDefenseBoost => {
            const defenseBoostAmount = currentDefenseBoost[target.id] || 0;
            const atkDownAmount = enemyAtkDown[eKey]?.amount || 0;
            const effectiveEnemyAtk = Math.max(enemy.attack - atkDownAmount, 1);
            const boostedDefense = target.defense + defenseBoostAmount;
            const baseDamage = effectiveEnemyAtk - boostedDefense;
            let damage = Math.max(baseDamage + Math.floor(Math.random() * 10), 1);
            let skillLog = '';

            // 敵スキル効果（攻撃系・回復以外）
            const enemySkill = (enemy as { skill_type?: string; skill_power?: number }).skill_type;
            const enemyPower = (enemy as { skill_type?: string; skill_power?: number }).skill_power || 100;
            if (enemySkill === 'insta_kill') {
              const chance = Math.min(enemyPower, 20) / 100;
              if (Math.random() < chance) {
                damage = target.hp;
                skillLog = ` ${getSkillName(enemySkill)}発動！`;
              }
            } else if (enemySkill === 'critical_strike') {
              damage = Math.floor(damage * 2);
              skillLog = ` ${getSkillName(enemySkill)}！`;
            } else if (enemySkill === 'execute') {
              if (target.hp <= target.max_hp * 0.3) {
                damage = Math.floor(damage * 1.8);
                skillLog = ` ${getSkillName(enemySkill)}！`;
              }
            } else if (enemySkill === 'blade_storm' || enemySkill === 'thunder_strike' || enemySkill === 'dark_strike') {
              damage = Math.floor(damage * 1.5);
              skillLog = ` ${getSkillName(enemySkill)}！`;
            } else if (enemySkill === 'damage_reflect' && damage > 0) {
              damage = Math.floor(damage * 1.3);
              skillLog = ` ${getSkillName(enemySkill)}！`;
            }

            // バリア吸収（最新のbarrierをrefから取得）
            const barrierAmount = barrierRef.current[target.id] || 0;
            let absorbed = 0;
            if (barrierAmount > 0) {
              absorbed = Math.min(damage, barrierAmount);
              damage = Math.max(damage - absorbed, 0);
              setBarrier(prev => {
                const next = { ...prev };
                const remain = (prev[target.id] || 0) - absorbed;
                if (remain > 0) next[target.id] = remain; else delete next[target.id];
                barrierRef.current = next;
                return next;
              });
            }

            // 防御力ブーストを消費（使用後は削除）
            const newDefenseBoost = { ...currentDefenseBoost };
            if (newDefenseBoost[target.id]) {
              delete newDefenseBoost[target.id];
            }

            const boostText = defenseBoostAmount > 0 ? `（防御力+${defenseBoostAmount}で軽減）` : '';
            const barrierText = absorbed > 0 ? `（バリアで${absorbed}吸収）` : '';
            addLog(`${enemy.emoji} ${enemy.name}の攻撃${skillLog}${boostText}${barrierText}！ ${target.member_emoji} ${target.member_name}に${damage}ダメージ！`);

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
    if (isProcessingVictory || battleResult || isBlockedByOtherTab) return;
    
    // 他のタブで実行中の場合、処理をブロック
    const { data: { user } } = await supabase.auth.getUser();
    if (user && tabSessionRef.current) {
      // 他のタブが同じバトルを実行中かチェック
      if (tabSessionRef.current.isBattleActive(user.id, stageId)) {
        // このタブがブロックされている場合、処理をスキップ
        if (isBlockedByOtherTab) {
          return;
        }
      }
    }
    
    setIsProcessingVictory(true);
    
    setBattleResult('victory');
    
    // 報酬計算
    const totalExp = enemies.reduce((sum, e) => sum + e.experience_reward, 0);
    const basePoints = enemies.reduce((sum, e) => sum + e.points_reward, 0);
    
    // 覇者の塔ボーナス（各階ごとの追加ポイント）
    const towerReward = isTowerStage(stageId) ? getTowerRewardByStage(stageId) : null;
    const bonusTowerPoints = towerReward?.bonusPoints ?? 0;
    const totalPoints = basePoints + bonusTowerPoints;
    
    setRewards({ exp: totalExp, points: totalPoints });
    
    // ★★★ レベルアップ処理 ★★★
    // ステージクリア時に経験値を付与し、レベルアップとステータス上昇を行う。
    // ただし装備は廃止済みなので、純粋にメンバー本体の成長のみ反映される。
    const allLevelUps: LevelUpResult[] = [];
    const updatedParty = party.map(member => {
      const { updatedMember, levelUps } = calculateLevelUp(member, totalExp);
      allLevelUps.push(...levelUps);
      // 勝利時はHPを全回復させておく
      return {
        ...updatedMember,
        hp: updatedMember.max_hp,
        current_hp: updatedMember.max_hp,
      };
    });
    
    // パーティ更新
    setParty(updatedParty);
    
    // レベルアップメッセージ
    if (allLevelUps.length > 0) {
      allLevelUps.forEach(levelUp => {
        const m = updatedParty.find(mm => mm.id === levelUp.member_id);
        addLog(`🎉 ${m?.member_emoji} ${m?.member_name} が Lv.${levelUp.new_level} にレベルアップ！`);
        addLog(`   HP+${levelUp.stat_gains.hp} ATK+${levelUp.stat_gains.attack} DEF+${levelUp.stat_gains.defense} SPD+${levelUp.stat_gains.speed}`);
      });
    }
    
    addLog(`戦闘に勝利した！ 経験値+${totalExp} ポイント+${totalPoints}`);
    if (towerReward && bonusTowerPoints > 0) {
      addLog(`🎁 ${towerReward.label}: 追加で+${bonusTowerPoints}ptを獲得！`);
    }

    // データベース更新（協力時は自分のメンバーのみ更新）
    if (user) {
      const membersToUpdate = mineIds.length > 0 ? updatedParty.filter(m => mineIds.includes(m.id)) : updatedParty;
      for (const member of membersToUpdate) {
        await supabase
          .from('user_members')
          .update({
            level: member.level,
            experience: member.experience,
            hp: member.max_hp, // 勝利時はHPを全回復して保存
            max_hp: member.max_hp,
            attack: member.attack,
            defense: member.defense,
            speed: member.speed,
            current_hp: member.max_hp
          })
          .eq('id', member.id);
      }
      
      // ポイント付与（覇者の塔ボーナスも含める）
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

      // 進行状況更新（パーティーモード・エクストラステージ・覇者の塔・Riemuイベントでは進行は更新しない）
      if (!partyStageId && !isExtraStage(stageId) && !isTowerStage(stageId) && !isRiemuEventStage(stageId)) {
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
        } else if (!isExtraStage(stageId)) {
          await supabase
            .from('user_progress')
            .insert({
              user_id: user.id,
              current_stage: stageId + 1,
              total_battles: 1,
              total_victories: 1
            });
        }
      }

      // 覇者の塔クリア記録（週単位で1回まで）
      if (isTowerStage(stageId)) {
        const weekStart = getCurrentWeekStartDate();
        const floor = stageId - TOWER_STAGE_START + 1;
        try {
          await supabase
            .from('tower_clears')
            .insert({
              user_id: user.id,
              floor,
              stage: stageId,
              week_start: weekStart
            });
        } catch {
          // UNIQUE制約違反等は無視（再実行された場合でもOK）
        }
      }

      // HST Riemu イベントステージ報酬付与＆クリア記録（1回限り）
      if (isRiemuEventStage(stageId)) {
        // ステージIDから付与するレアリティ・名前を決定
        type Rarity = 'HST' | 'stary' | 'legendary' | 'ultra-rare' | 'super-rare' | 'rare' | 'common';
        const rewardConfig: Record<number, { name: string; emoji: string; rarity: Rarity }> = {
          3001: { name: 'riemu', emoji: '🌟', rarity: 'common' },
          3002: { name: 'riemu', emoji: '🌟', rarity: 'rare' },
          3003: { name: 'riemu', emoji: '🌟', rarity: 'super-rare' },
          3004: { name: 'riemu', emoji: '🌟', rarity: 'ultra-rare' },
          3005: { name: 'riemu', emoji: '🌟', rarity: 'legendary' },
          3006: { name: 'HST riemu', emoji: '🌟', rarity: 'HST' },
        };
        const reward = rewardConfig[stageId as (typeof RIEMU_EVENT_STAGES)[number]];
        if (reward) {
          // ベースステータスはガチャと同じテーブルを使用
          const baseStats: { [key in Rarity]: { hp: number; attack: number; defense: number; speed: number } } = {
            HST:        { hp: 300, attack: 100, defense: 50, speed: 60 },
            stary:      { hp: 200, attack: 65, defense: 30, speed: 40 },
            legendary:  { hp: 150, attack: 45, defense: 20, speed: 25 },
            'ultra-rare': { hp: 120, attack: 35, defense: 15, speed: 20 },
            'super-rare': { hp: 100, attack: 28, defense: 12, speed: 15 },
            rare:       { hp: 80, attack: 22, defense: 10, speed: 12 },
            common:     { hp: 60, attack: 16, defense: 8, speed: 10 },
          };
          const stats = baseStats[reward.rarity];

          // すでに同じ名前＆レアリティを持っているか軽くチェック（重複付与防止）
          const { data: existing } = await supabase
            .from('user_members')
            .select('id')
            .eq('user_id', user.id)
            .eq('member_name', reward.name)
            .eq('rarity', reward.rarity)
            .maybeSingle();

          if (!existing) {
            const { error: insertErr } = await supabase
              .from('user_members')
              .insert({
                user_id: user.id,
                member_name: reward.name,
                member_emoji: reward.emoji,
                member_description: 'HST Riemu イベント報酬',
                rarity: reward.rarity,
                level: 1,
                experience: 0,
                hp: stats.hp,
                max_hp: stats.hp,
                current_hp: stats.hp,
                attack: stats.attack,
                defense: stats.defense,
                speed: stats.speed,
                skill_type: reward.rarity === 'legendary' || reward.rarity === 'HST' ? 'riemu_blessing' : null,
                skill_power: 0,
                revive_used: false,
              });

            if (insertErr) {
              console.error('Riemu イベント報酬付与エラー:', insertErr);
              alert(`キャラクターの付与に失敗しました: ${insertErr.message}\nもう一度お試しください。`);
              // 付与失敗時はクリア記録を入れない（再挑戦可能にする）
            } else {
              // 付与成功時のみクリア記録（再挑戦禁止）
              await supabase.from('riemu_event_clears').insert({
                user_id: user.id,
                stage: stageId,
                rarity: reward.rarity,
              });
              // UNIQUE違反等のエラーは無視（既に記録済みなら問題なし）
            }
          } else {
            // 既に持っている場合もクリア記録を入れる（再挑戦禁止のため）
            await supabase.from('riemu_event_clears').insert({
              user_id: user.id,
              stage: stageId,
              rarity: reward.rarity,
            });
            // UNIQUE違反等のエラーは無視
          }
        }
      }

      // バトルログ保存（パーティーモードは stage 0 で記録し、ステージ進行判定に影響させない）
      const logStage = partyStageId ? 0 : stageId;
      await supabase
        .from('battle_logs')
        .insert({
          user_id: user.id,
          stage: logStage,
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

      // 装備機能廃止: エクストラステージの武器ドロップも無効化

      // ミッション進捗更新
      await updateMissionProgress(user.id, 'battle_win', 1);
      await updateMissionProgress(user.id, 'battle_complete', 1);
      await updateMissionProgress(user.id, 'stage_clear', 1);
      
      // レベルアップが発生した場合
      if (allLevelUps.length > 0) {
        await updateMissionProgress(user.id, 'level_up', allLevelUps.length);
      }

      // バトルセッションを終了
      if (tabSessionRef.current) {
        tabSessionRef.current.endBattle(user.id, stageId);
      }
    }
    
    // ★ レベルアップ情報をステートに保存（演出用）
    setLevelUpResults(allLevelUps);
  }

  async function handleDefeat() {
    // 重複実行を防止
    if (battleResult || isBlockedByOtherTab) return;
    
    setBattleResult('defeat');
    addLog('全滅してしまった...');

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // バトルセッションを終了
      if (tabSessionRef.current) {
        tabSessionRef.current.endBattle(user.id, stageId);
      }
      // 敗北時も全キャラクターのHPを全回復（協力時は自分のメンバーのみDB更新）
      const restoredParty = party.map(member => ({
        ...member,
        hp: member.max_hp,
        current_hp: member.max_hp
      }));
      const toRestore = mineIds.length > 0 ? restoredParty.filter(m => mineIds.includes(m.id)) : restoredParty;
      for (const member of toRestore) {
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
          {isBlockedByOtherTab && (
            <div className="bg-red-600 text-white p-4 rounded-lg mb-4 border-2 border-red-800">
              <div className="font-bold text-lg">⚠️ 警告</div>
              <div className="mt-2">
                他のタブで同じバトルが実行中です。このタブでの操作は無効になります。
                <br />
                他のタブを閉じてから再度お試しください。
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold">⚔️ バトル - ステージ{stageId} - ターン {turn}</h1>
            {!battleResult && (
              <button
                onClick={() => setIsAutoMode(prev => !prev)}
                disabled={isBlockedByOtherTab}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  isBlockedByOtherTab
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : isAutoMode 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/50' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {isAutoMode ? '🔄 オート ON' : 'オート OFF'}
              </button>
            )}
          </div>
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
                  onClick={() => {
                    if (isPlayerTurn && member.hp > 0) {
                      setSelectedMember(index);
                      setPendingEnemyTargetMember(null);
                    }
                  }}
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
                      <div className="text-sm text-gray-900 font-semibold">Lv.{member.level}</div>
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
                        style={{
                          width: `${member.max_hp > 0
                            ? Math.min(Math.max((member.hp / member.max_hp) * 100, 0), 100)
                            : 0
                          }%`
                        }}
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
                                    ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
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
                                  ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
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
                              ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
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
                      ) : SKILLS_NEED_ENEMY_TARGET.has(member.skill_type || '') ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingEnemyTargetMember(index);
                          }}
                          disabled={skillCooldown[member.id] > 0}
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition ${
                            skillCooldown[member.id] > 0
                              ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
                              : 'bg-orange-500 text-white hover:bg-orange-600'
                          }`}
                        >
                          {skillCooldown[member.id] > 0 
                            ? `クールダウン: ${skillCooldown[member.id]}`
                            : '敵を選択してクリック'
                          }
                        </button>
                      ) : SKILLS_NEED_ALLY_TARGET.has(member.skill_type || '') && member.skill_type !== 'heal' ? (
                        <div className="space-y-1">
                          {party.map((target, tIndex) => (
                            target.hp > 0 && (
                              <button
                                key={tIndex}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useSkill(index, tIndex);
                                }}
                                disabled={skillCooldown[member.id] > 0}
                                className={`w-full px-2 py-1 rounded text-xs font-bold transition ${
                                  skillCooldown[member.id] > 0
                                    ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                }`}
                              >
                                {skillCooldown[member.id] > 0 
                                  ? `CT:${skillCooldown[member.id]}`
                                  : `${target.member_name}に`
                                }
                              </button>
                            )
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useSkill(index);
                          }}
                          disabled={skillCooldown[member.id] > 0}
                          className={`w-full px-3 py-2 rounded text-sm font-bold transition ${
                            skillCooldown[member.id] > 0
                              ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
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
                    <div className="mt-1 text-xs text-gray-900 text-center">
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
                  onClick={() => {
                    if (pendingEnemyTargetMember !== null && enemy.hp > 0 && isPlayerTurn) {
                      useSkill(pendingEnemyTargetMember, undefined, index);
                      setPendingEnemyTargetMember(null);
                    } else if (selectedMember !== null && enemy.hp > 0 && isPlayerTurn) {
                      playerAttack(selectedMember, index);
                    }
                  }}
                  className={`border-2 border-red-300 rounded-lg p-4 transition ${
                    (selectedMember !== null || pendingEnemyTargetMember !== null) && enemy.hp > 0 && isPlayerTurn ? 'cursor-pointer hover:border-red-500 hover:bg-red-50' : ''
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
                      <div className="font-bold text-lg text-black">{enemy.name}</div>
                    </div>
                    <div className="text-right text-sm text-black">
                      <div className="font-semibold">ATK: {enemy.attack}</div>
                      <div className="font-semibold">DEF: {enemy.defense}</div>
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="flex justify-between text-xs mb-1 text-black">
                      <span>HP</span>
                      <span>{enemy.hp}/{enemy.max_hp}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full transition-all"
                        style={{
                          width: `${enemy.max_hp > 0
                            ? Math.min(Math.max((enemy.hp / enemy.max_hp) * 100, 0), 100)
                            : 0
                          }%`
                        }}
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
              <div className="text-gray-900">戦闘ログがここに表示されます...</div>
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
                    <p className="text-gray-900">ステージ{stageId}をクリアしました！</p>
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
                                  <div className="text-gray-900">HP</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.hp}</div>
                                </div>
                                <div className="text-center bg-orange-50 rounded p-1">
                                  <div className="text-gray-900">ATK</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.attack}</div>
                                </div>
                                <div className="text-center bg-blue-50 rounded p-1">
                                  <div className="text-gray-900">DEF</div>
                                  <div className="text-green-600 font-bold">+{levelUp.stat_gains.defense}</div>
                                </div>
                                <div className="text-center bg-yellow-50 rounded p-1">
                                  <div className="text-gray-900">SPD</div>
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
                      {droppedWeapon && (
                        <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-green-200">
                          <span>武器ドロップ:</span>
                          <span className="font-bold text-amber-600">🎉 {droppedWeapon}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (partyStageId) {
                          router.push(`/party/stages?party=${partyIds.join(',')}`);
                        } else if (isTowerStage(stageId)) {
                          // 覇者の塔: 次の階があればそのままバトルへ
                          const nextStage = stageId + 1;
                          if (nextStage <= TOWER_STAGE_END) {
                            router.push(`/adventure/stage/${nextStage}?party=${partyIds.join(',')}`);
                          } else {
                            router.push('/adventure/tower');
                          }
                        } else if (isRiemuEventStage(stageId)) {
                          // Riemuイベント: 一覧に戻る
                          router.push('/adventure/riemu-event');
                        } else if (isExtraStage(stageId) && stageId >= EXTRA_STAGE_END) {
                          router.push(`/adventure/stages?party=${partyIds.join(',')}&extra=1`);
                        } else {
                          router.push(`/adventure/stage/${stageId + 1}?party=${partyIds.join(',')}`);
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-bold hover:opacity-90"
                    >
                      {partyStageId ? 'ステージ一覧へ' : isExtraStage(stageId) && stageId >= EXTRA_STAGE_END ? 'ステージ選択へ' : '次のステージへ'}
                    </button>
                    <button
                      onClick={() => {
                        if (partyStageId) {
                          router.push('/party');
                        } else if (isTowerStage(stageId)) {
                          router.push('/adventure/tower');
                        } else if (isRiemuEventStage(stageId)) {
                          router.push('/adventure/riemu-event');
                        } else {
                          router.push('/adventure');
                        }
                      }}
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
                    <p className="text-lg text-gray-900">{partyStageId ? `パーティステージ${partyStageInfo?.order ?? ''}で敗北しました` : `ステージ${stageId}で敗北しました`}</p>
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
                      onClick={() =>
                        router.push(
                          partyStageId
                            ? `/adventure/battle?party_stage_id=${partyStageId}&party=${partyIds.join(',')}`
                            : `/adventure/stage/${stageId}?party=${partyIds.join(',')}`
                        )
                      }
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-lg font-bold text-lg hover:opacity-90 shadow-lg transform hover:scale-105 transition-all"
                    >
                      🔄 リトライ
                    </button>
                    <button
                      onClick={() => {
                        if (partyStageId) {
                          router.push('/party');
                        } else if (isTowerStage(stageId)) {
                          router.push('/adventure/tower');
                        } else if (isRiemuEventStage(stageId)) {
                          router.push('/adventure/riemu-event');
                        } else {
                          router.push('/adventure');
                        }
                      }}
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
