'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import { Member } from '@/types/adventure';
import { getSkillName } from '@/utils/skills';
import { SKILLS_NEED_ENEMY_TARGET, SKILLS_NEED_ALLY_TARGET } from '@/utils/skills';

interface BattleState {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_party: string[];
  player2_party: string[];
  player1_hp: { [key: string]: number };
  player2_hp: { [key: string]: number };
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  turn_number: number;
  current_turn_player: string;
  battle_log: string[];
  winner_id?: string;
  battle_buffs?: { [memberId: string]: { attackBoost?: number; defenseBoost?: number } };
}

interface PlayerInfo {
  id: string;
  name: string;
  party: Member[];
  hp: { [key: string]: number };
}

export default function PvPBattlePage() {
  const params = useParams();
  const battleId = params.id as string;
  const router = useRouter();

  const [battle, setBattle] = useState<BattleState | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null);
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'attack' | 'skill' | null>(null);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [selectedAllyTarget, setSelectedAllyTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [battleResult, setBattleResult] = useState<{ won: boolean; winnerName: string } | null>(null);
  const player2LoadedRef = useRef(false);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    initBattle();
    return subscribeToRealtimeUpdates();
  }, []);

  useEffect(() => {
    if (battle && currentUser) {
      setIsMyTurn(battle.current_turn_player === currentUser && battle.status === 'in_progress');
    }
  }, [battle, currentUser]);

  async function initBattle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUser(user.id);

    // バトル情報取得
    const { data: battleData } = await supabase
      .from('pvp_battles')
      .select('*')
      .eq('id', battleId)
      .single();

    if (!battleData) {
      alert('バトルが見つかりません');
      router.push('/friends');
      return;
    }

    setBattle(battleData);
    setBattleLog(battleData.battle_log || []);

    // プレイヤー情報取得
    await loadPlayerInfo(battleData);

    // 相手が参加していない場合は待機
    if (battleData.status === 'waiting' && !battleData.player2_party) {
      if (user.id === battleData.player2_id) {
        // 自分がplayer2なら参加処理
        await joinBattle(battleData);
      }
    }

    setLoading(false);
  }

  async function loadPlayerInfo(battleData: BattleState) {
    // Player1のメンバー取得
    const { data: p1Members } = await supabase
      .from('user_members')
      .select('*')
      .in('id', battleData.player1_party);

    const { data: p1Profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', battleData.player1_id)
      .single();

    // Player2のメンバー取得
    let p2Members = null;
    let p2Profile = null;

    if (battleData.player2_party && battleData.player2_party.length > 0) {
      const { data: members } = await supabase
        .from('user_members')
        .select('*')
        .in('id', battleData.player2_party);
      p2Members = members;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', battleData.player2_id)
        .single();
      p2Profile = profile;
    }

    setPlayer1({
      id: battleData.player1_id,
      name: p1Profile?.display_name || 'Player 1',
      party: p1Members || [],
      hp: battleData.player1_hp || {}
    });

    if (p2Members && p2Profile) {
      setPlayer2({
        id: battleData.player2_id,
        name: p2Profile.display_name,
        party: p2Members,
        hp: battleData.player2_hp || {}
      });
      player2LoadedRef.current = true;
    }
  }

  async function joinBattle(battleData: BattleState) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== battleData.player2_id) return;

    // player2がパーティを選択していない場合はマッチング画面へ
    if (!battleData.player2_party || battleData.player2_party.length === 0) {
      router.push(`/pvp/matchmaking?friend=${battleData.player1_id}&battle=${battleId}`);
      return;
    }

    // パーティが選択済みの場合はバトル開始
    const initialHp: { [key: string]: number } = {};
    const { data: members } = await supabase
      .from('user_members')
      .select('*')
      .in('id', battleData.player2_party);

    if (members) {
      members.forEach(member => {
        initialHp[member.id] = member.max_hp;
      });

      await supabase
        .from('pvp_battles')
        .update({
          player2_hp: initialHp,
          status: 'in_progress',
          battle_log: [...(battleData.battle_log || []), 'バトル開始！']
        })
        .eq('id', battleId);
    }
  }

  function subscribeToRealtimeUpdates() {
    const channel = supabase
      .channel(`pvp_battle:${battleId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pvp_battles',
          filter: `id=eq.${battleId}`
        },
        async (payload) => {
          const newBattle = payload.new as BattleState;
          setBattle(newBattle);
          setBattleLog(newBattle.battle_log || []);

          // 相手の手番・チームのHPをリアルタイムで反映（DBの最新状態で再描画）
          if (newBattle.status === 'in_progress' && newBattle.player2_party?.length && !player2LoadedRef.current) {
            await loadPlayerInfo(newBattle);
          }
          // 自分のターンに切り替わったら選択をクリア
          if (newBattle.current_turn_player === currentUserRef.current) {
            setSelectedAction(null);
            setSelectedMember(null);
            setSelectedTarget(null);
            setSelectedAllyTarget(null);
          }
          if (newBattle.status === 'completed') {
            setTimeout(() => showResult(newBattle), 2000);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async function executeAction() {
    if (!selectedAction || !battle || !player1 || !player2) return;
    if (selectedAction === 'attack' && (selectedMember === null || selectedTarget === null)) return;
    if (selectedAction === 'skill' && selectedMember === null) return;

    const isPlayer1 = currentUser === battle.player1_id;
    const attacker = isPlayer1 ? player1 : player2;
    const defender = isPlayer1 ? player2 : player1;

    let newLog = [...battleLog];
    let newPlayer1Hp = { ...battle.player1_hp };
    let newPlayer2Hp = { ...battle.player2_hp };
    let newBuffs = { ...(battle.battle_buffs || {}) };

    const attackerMember = attacker.party[selectedMember!];
    if (!attackerMember) return;

    const attackerHpKey = attackerMember.id;
    const attackerCurrentHp = isPlayer1 
      ? newPlayer1Hp[attackerHpKey] ?? attackerMember.max_hp
      : newPlayer2Hp[attackerHpKey] ?? attackerMember.max_hp;

    if (attackerCurrentHp <= 0 && attackerMember.skill_type !== 'revive') {
      alert('このメンバーは戦闘不能です');
      return;
    }

    const attackBoost = newBuffs[attackerHpKey]?.attackBoost ?? 0;

    if (selectedAction === 'attack' && selectedTarget !== null) {
      const targetMember = defender.party[selectedTarget];
      if (!targetMember) return;

      const targetHpKey = targetMember.id;
      const targetCurrentHp = isPlayer1 
        ? newPlayer2Hp[targetHpKey] ?? targetMember.max_hp
        : newPlayer1Hp[targetHpKey] ?? targetMember.max_hp;

      if (targetCurrentHp <= 0) {
        alert('この敵は既に倒れています');
        return;
      }

      const defBoost = newBuffs[targetHpKey]?.defenseBoost ?? 0;
      const baseDamage = attackerMember.attack - Math.max(targetMember.defense - defBoost, 0);
      const damage = Math.max(baseDamage + attackBoost + Math.floor(Math.random() * 10), 1);
      
      const newHp = Math.max(targetCurrentHp - damage, 0);

      if (isPlayer1) {
        newPlayer2Hp[targetHpKey] = newHp;
      } else {
        newPlayer1Hp[targetHpKey] = newHp;
      }

      newLog.push(
        `${attackerMember.member_emoji} ${attackerMember.member_name}が ${targetMember.member_emoji} ${targetMember.member_name}に${damage}ダメージ！`
      );

      if (newHp === 0) {
        newLog.push(`${targetMember.member_emoji} ${targetMember.member_name}は倒れた！`);
      }

      if (attackBoost > 0) {
        delete newBuffs[attackerHpKey];
      }
    } else if (selectedAction === 'skill') {
      const skillType = attackerMember.skill_type;
      const skillPower = attackerMember.skill_power || 20;

      if (skillType === 'attack_boost') {
        newBuffs[attackerHpKey] = { ...newBuffs[attackerHpKey], attackBoost: skillPower };
        newLog.push(`⚔️ ${attackerMember.member_emoji} ${attackerMember.member_name}の攻撃力が${skillPower}アップ！`);
      } else if (skillType === 'defense_boost') {
        newBuffs[attackerHpKey] = { ...newBuffs[attackerHpKey], defenseBoost: skillPower };
        newLog.push(`🛡️ ${attackerMember.member_emoji} ${attackerMember.member_name}の防御力が${skillPower}アップ！`);
      } else if (skillType === 'heal') {
        const targetIdx = selectedAllyTarget ?? selectedMember;
        if (targetIdx != null) {
          const healTarget = attacker.party[targetIdx];
          if (healTarget) {
            const healHpKey = healTarget.id;
            const currentHp = isPlayer1 
              ? newPlayer1Hp[healHpKey] ?? healTarget.max_hp
              : newPlayer2Hp[healHpKey] ?? healTarget.max_hp;
            const newHp = Math.min(currentHp + skillPower, healTarget.max_hp);
            if (isPlayer1) {
              newPlayer1Hp[healHpKey] = newHp;
            } else {
              newPlayer2Hp[healHpKey] = newHp;
            }
            newLog.push(`💚 ${attackerMember.member_emoji} ${attackerMember.member_name}が ${healTarget.member_name}のHPを${skillPower}回復！`);
          }
        }
      } else if (skillType === 'power_strike' && selectedTarget !== null) {
        const targetMember = defender.party[selectedTarget];
        if (targetMember) {
          const targetHpKey = targetMember.id;
          const targetCurrentHp = isPlayer1 
            ? newPlayer2Hp[targetHpKey] ?? targetMember.max_hp
            : newPlayer1Hp[targetHpKey] ?? targetMember.max_hp;

          if (targetCurrentHp > 0) {
            const strikePower = skillPower + attackerMember.attack + attackBoost;
            const damage = Math.max(strikePower - targetMember.defense, Math.floor(strikePower * 0.3));
            const newHp = Math.max(targetCurrentHp - damage, 0);

            if (isPlayer1) {
              newPlayer2Hp[targetHpKey] = newHp;
            } else {
              newPlayer1Hp[targetHpKey] = newHp;
            }
            newLog.push(`💥 ${attackerMember.member_emoji} ${attackerMember.member_name}の威力抜撃！ ${targetMember.member_name}に${damage}ダメージ！`);
            if (newHp === 0) {
              newLog.push(`${targetMember.member_emoji} ${targetMember.member_name}は倒れた！`);
            }
            if (attackBoost > 0) delete newBuffs[attackerHpKey];
          }
        }
      } else if (skillType === 'revive' && attackerCurrentHp <= 0) {
        const reviveHp = Math.floor(attackerMember.max_hp * 0.5);
        if (isPlayer1) {
          newPlayer1Hp[attackerHpKey] = reviveHp;
        } else {
          newPlayer2Hp[attackerHpKey] = reviveHp;
        }
        newLog.push(`✨ ${attackerMember.member_emoji} ${attackerMember.member_name}が蘇生！HP${reviveHp}で復活！`);
      } else if (skillType === 'all_heal') {
        attacker.party.forEach(m => {
          const hpKey = m.id;
          const currentHp = isPlayer1 ? newPlayer1Hp[hpKey] ?? m.max_hp : newPlayer2Hp[hpKey] ?? m.max_hp;
          if (currentHp > 0 && currentHp < m.max_hp) {
            const newHp = Math.min(currentHp + skillPower, m.max_hp);
            if (isPlayer1) newPlayer1Hp[hpKey] = newHp;
            else newPlayer2Hp[hpKey] = newHp;
          }
        });
        newLog.push(`💚 ${attackerMember.member_emoji} ${attackerMember.member_name}が全体回復！`);
      } else if (skillType === 'hst_power') {
        const pwr = (skillPower || 40) + attackerMember.attack + attackBoost;
        defender.party.forEach((m, idx) => {
          const currentHp = isPlayer1 ? newPlayer2Hp[m.id] ?? m.max_hp : newPlayer1Hp[m.id] ?? m.max_hp;
          if (currentHp > 0) {
            const damage = Math.max(Math.floor(pwr * 0.6) - m.defense, Math.floor(pwr * 0.2));
            const newHp = Math.max(currentHp - damage, 0);
            if (isPlayer1) newPlayer2Hp[m.id] = newHp;
            else newPlayer1Hp[m.id] = newHp;
          }
        });
        newLog.push(`👑 ${attackerMember.member_emoji} ${attackerMember.member_name}がHSTパワーで全体攻撃！`);
        if (attackBoost > 0) delete newBuffs[attackerHpKey];
      } else {
        newLog.push(`${attackerMember.member_emoji} ${attackerMember.member_name}の${getSkillName(skillType)}は未実装です`);
      }
    }

    // 全滅チェック
    const player1Alive = player1.party.some(member => {
      const hp = newPlayer1Hp[member.id] ?? member.max_hp;
      return hp > 0;
    });
    const player2Alive = player2 ? player2.party.some(member => {
      const hp = newPlayer2Hp[member.id] ?? member.max_hp;
      return hp > 0;
    }) : false;

    let newStatus = battle.status;
    let winnerId = battle.winner_id;

    if (!player1Alive && player2) {
      newStatus = 'completed';
      winnerId = battle.player2_id;
      newLog.push(`🎉 ${player2.name}の勝利！`);
    } else if (!player2Alive) {
      newStatus = 'completed';
      winnerId = battle.player1_id;
      newLog.push(`🎉 ${player1.name}の勝利！`);
    }

    // ターン交代
    const nextTurnPlayer = battle.current_turn_player === battle.player1_id
      ? battle.player2_id
      : battle.player1_id;

    // バトル状態更新
    const { error } = await supabase
      .from('pvp_battles')
      .update({
        player1_hp: newPlayer1Hp,
        player2_hp: newPlayer2Hp,
        turn_number: battle.turn_number + 1,
        current_turn_player: newStatus === 'completed' ? battle.current_turn_player : nextTurnPlayer,
        battle_log: newLog,
        status: newStatus,
        winner_id: winnerId,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        battle_buffs: newBuffs,
        updated_at: new Date().toISOString()
      })
      .eq('id', battleId);

    if (error) {
      alert('アクションの実行に失敗しました');
      return;
    }

    // 完了時の処理
    if (newStatus === 'completed' && winnerId) {
      await updateStats(winnerId);
    }

    setSelectedAction(null);
    setSelectedMember(null);
    setSelectedTarget(null);
    setSelectedAllyTarget(null);
  }

  async function updateStats(winnerId: string) {
    if (!battle) return;

    const loserId = winnerId === battle.player1_id ? battle.player2_id : battle.player1_id;

    // 勝者のレーティング上昇
    await supabase.rpc('update_pvp_stats', {
      p_user_id: winnerId,
      p_won: true
    });

    // 敗者のレーティング下降
    await supabase.rpc('update_pvp_stats', {
      p_user_id: loserId,
      p_won: false
    });
  }

  function showResult(battleData: BattleState) {
    const won = battleData.winner_id === currentUser;
    const winnerName = won 
      ? (currentUser === battleData.player1_id ? player1?.name : player2?.name) || 'あなた'
      : (battleData.winner_id === battleData.player1_id ? player1?.name : player2?.name) || '相手';
    
    setBattleResult({ won, winnerName });
  }

  async function forfeit() {
    const confirmed = confirm('対戦を棄権しますか？');
    if (!confirmed) return;

    if (!battle) return;

    const winnerId = currentUser === battle.player1_id 
      ? battle.player2_id 
      : battle.player1_id;

    await supabase
      .from('pvp_battles')
      .update({
        status: 'completed',
        winner_id: winnerId,
        completed_at: new Date().toISOString()
      })
      .eq('id', battleId);

    if (winnerId) {
      await updateStats(winnerId);
    }

    alert('棄権しました');
    router.push('/friends');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">
          バトル準備中...
        </div>
      </div>
    );
  }

  if (!battle || !player1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-xl">バトルが見つかりません</div>
      </div>
    );
  }

  // 待機中
  if (battle.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center">
            <div className="text-6xl mb-6 animate-bounce">⏳</div>
            <h1 className="text-3xl font-bold mb-4">対戦相手を待っています...</h1>
            <p className="text-gray-900 mb-8">
              {player2 ? `${player2.name}が参加するのを待っています` : '相手が参加するのを待っています'}
            </p>
            <button
              onClick={forfeit}
              className="bg-red-500 text-white px-8 py-3 rounded-full font-bold hover:bg-red-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPlayer1 = currentUser === battle.player1_id;
  const myParty = isPlayer1 ? player1 : player2;
  const enemyParty = isPlayer1 ? player2 : player1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center text-white mb-6">
          <h1 className="text-4xl font-bold mb-2">⚔️ PvP対戦</h1>
          <div className="text-xl">
            <span className="font-bold">{player1.name}</span>
            {' vs '}
            <span className="font-bold">{player2?.name || '???'}</span>
          </div>
          <div className="text-sm opacity-90 mt-2">
            ターン {battle.turn_number} {isMyTurn ? '● あなたのターン' : '○ 相手のターン'}
          </div>
        </div>

        {/* バトルフィールド */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Player 1 */}
          <div className={`bg-white rounded-2xl p-6 shadow-2xl ${
            battle.current_turn_player === player1.id ? 'ring-4 ring-yellow-400' : ''
          }`}>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold">{player1.name}</h2>
              <div className="text-sm text-gray-900">
                {currentUser === player1.id ? '(あなた)' : '(相手)'}
              </div>
            </div>
            <div className="space-y-3">
              {player1.party.map((member, index) => {
                const currentHp = battle.player1_hp[member.id] ?? member.max_hp;
                const hpPercent = (currentHp / member.max_hp) * 100;
                
                return (
                  <div
                    key={member.id}
                    className={`p-4 border-2 rounded-lg ${
                      currentHp > 0 ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-100 opacity-50'
                    } ${
                      selectedTarget === index && !isPlayer1 && currentHp > 0 ? 'ring-4 ring-red-400' : ''
                    } ${
                      selectedMember === index && isPlayer1 && currentHp > 0 ? 'ring-4 ring-blue-400' : ''
                    }`}
                    onClick={() => {
                      if (!isMyTurn) return;
                      if (selectedAction === 'attack') {
                        if (isPlayer1 && currentHp > 0) setSelectedMember(index);
                        else if (!isPlayer1 && currentHp > 0) setSelectedTarget(index);
                      } else if (selectedAction === 'skill') {
                        if (isPlayer1) {
                          if (selectedMember === null && currentHp > 0) setSelectedMember(index);
                          else if (selectedMember !== null && member.skill_type && SKILLS_NEED_ALLY_TARGET.has(member.skill_type) && currentHp > 0) setSelectedAllyTarget(index);
                        } else {
                          if (selectedMember === null && currentHp > 0) setSelectedMember(index);
                          else if (selectedMember !== null && member.skill_type && SKILLS_NEED_ALLY_TARGET.has(member.skill_type) && currentHp > 0) setSelectedAllyTarget(index);
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{member.member_emoji}</span>
                        <div>
                          <div className="font-bold">{member.member_name}</div>
                          <div className="text-xs text-gray-900">Lv.{member.level}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          HP: {currentHp}/{member.max_hp}
                        </div>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${hpPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player 2 */}
          {player2 && (
            <div className={`bg-white rounded-2xl p-6 shadow-2xl ${
              battle.current_turn_player === player2.id ? 'ring-4 ring-yellow-400' : ''
            }`}>
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold">{player2.name}</h2>
                <div className="text-sm text-gray-900">
                  {currentUser === player2.id ? '(あなた)' : '(相手)'}
                </div>
              </div>
              <div className="space-y-3">
                {player2.party.map((member, index) => {
                  const currentHp = battle.player2_hp[member.id] ?? member.max_hp;
                  const hpPercent = (currentHp / member.max_hp) * 100;
                  
                  return (
                    <div
                      key={member.id}
                      className={`p-4 border-2 rounded-lg ${
                        currentHp > 0 ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-100 opacity-50'
                      } ${
                        selectedTarget === index && isPlayer1 && currentHp > 0 ? 'ring-4 ring-red-400' : ''
                      } ${
                        selectedMember === index && !isPlayer1 && currentHp > 0 ? 'ring-4 ring-blue-400' : ''
                      }`}
                      onClick={() => {
                        if (!isMyTurn) return;
                        if (isPlayer1) {
                          if (selectedAction === 'attack' && currentHp > 0) setSelectedTarget(index);
                          else if (selectedAction === 'skill' && selectedMember !== null && currentHp > 0) setSelectedTarget(index);
                        } else {
                          if (selectedAction === 'attack' && currentHp > 0) setSelectedMember(index);
                          else if (selectedAction === 'skill') {
                            if (selectedMember === null && currentHp > 0) setSelectedMember(index);
                            else if (selectedMember !== null && member.skill_type && SKILLS_NEED_ALLY_TARGET.has(member.skill_type) && currentHp > 0) setSelectedAllyTarget(index);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{member.member_emoji}</span>
                          <div>
                            <div className="font-bold">{member.member_name}</div>
                            <div className="text-xs text-gray-900">Lv.{member.level}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            HP: {currentHp}/{member.max_hp}
                          </div>
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${hpPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* アクションパネル */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h3 className="text-xl font-bold mb-4">アクション</h3>
          {isMyTurn ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setSelectedAction('attack'); setSelectedMember(null); setSelectedTarget(null); setSelectedAllyTarget(null); }}
                  className={`px-6 py-4 rounded-lg font-bold text-lg ${
                    selectedAction === 'attack'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  ⚔️ 攻撃
                </button>
                <button
                  onClick={() => { setSelectedAction('skill'); setSelectedMember(null); setSelectedTarget(null); setSelectedAllyTarget(null); }}
                  className={`px-6 py-4 rounded-lg font-bold text-lg ${
                    selectedAction === 'skill'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  ✨ スキル
                </button>
              </div>

              {selectedAction === 'attack' && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-gray-700">
                    {selectedMember === null ? '攻撃するメンバーを選択' : selectedTarget === null ? '攻撃する敵を選択' : '準備完了'}
                  </div>
                  {selectedMember !== null && selectedTarget !== null && (
                    <button
                      onClick={executeAction}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90"
                    >
                      実行する
                    </button>
                  )}
                </div>
              )}

              {selectedAction === 'skill' && (
                <div className="space-y-2">
                  {selectedMember === null ? (
                    <div className="text-sm font-bold text-gray-700">スキルを使うメンバーを選択</div>
                  ) : (() => {
                    const member = myParty!?.party[selectedMember];
                    const skillType = member?.skill_type;
                    const needsEnemy = skillType && SKILLS_NEED_ENEMY_TARGET.has(skillType);
                    const needsAlly = skillType && SKILLS_NEED_ALLY_TARGET.has(skillType);
                    const canExecute = !needsEnemy && !needsAlly ? true : needsEnemy ? selectedTarget !== null : true;
                    return (
                      <>
                        <div className="text-sm font-bold text-gray-700">
                          {member?.member_name}の{getSkillName(skillType)}
                          {needsEnemy && (selectedTarget === null ? ' → 攻撃する敵を選択' : ' → 準備完了')}
                          {needsAlly && (selectedAllyTarget === null ? ' → 回復する味方を選択' : ' → 準備完了')}
                          {!needsEnemy && !needsAlly && ' → 準備完了'}
                        </div>
                        {canExecute && (
                          <button
                            onClick={executeAction}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:opacity-90"
                          >
                            スキル実行
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-900">
              相手のターンです...
            </div>
          )}
        </div>

        {/* バトルログ */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h3 className="text-xl font-bold mb-4">📜 バトルログ</h3>
          <div className="h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-2">
            {battleLog.length === 0 ? (
              <div className="text-sm text-gray-900 text-center">バトルログがありません</div>
            ) : (
              battleLog.map((log, index) => (
                <div key={index} className="text-sm text-gray-700">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 棄権ボタン */}
        <div className="text-center">
          <button
            onClick={forfeit}
            className="bg-gray-500 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-600"
          >
            棄権する
          </button>
        </div>
      </div>

      {/* バトル結果モーダル */}
      {battleResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            {battleResult.won ? (
              <>
                <div className="text-center mb-6">
                  <div className="text-8xl mb-4 animate-bounce">🎉</div>
                  <h2 className="text-4xl font-bold text-green-600 mb-2">勝利！</h2>
                  <p className="text-xl text-gray-700">おめでとうございます！</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border-2 border-green-300">
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-green-700">
                      レーティング +25
                    </div>
                    <div className="text-sm text-gray-900">
                      {battleResult.winnerName}の勝利！
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/pvp/history')}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-lg font-bold text-lg hover:opacity-90 shadow-lg"
                >
                  バトル履歴を見る
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="text-8xl mb-6 animate-pulse">💀</div>
                  <h2 className="text-5xl font-bold text-red-600 mb-4 animate-bounce">GAME OVER</h2>
                  <p className="text-2xl text-gray-700 mb-2 font-semibold">敗北してしまいました...</p>
                  <p className="text-lg text-gray-900">{battleResult.winnerName}に敗れました</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 mb-6 border-2 border-red-300">
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-red-700">
                      レーティング -15
                    </div>
                    <div className="text-sm text-gray-900">
                      次回は頑張りましょう！
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push('/pvp/matchmaking')}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-lg font-bold text-lg hover:opacity-90 shadow-lg transform hover:scale-105 transition-all"
                  >
                    🔄 再マッチング
                  </button>
                  <button
                    onClick={() => router.push('/pvp/history')}
                    className="flex-1 bg-gray-200 text-gray-700 px-6 py-4 rounded-lg font-bold text-lg hover:bg-gray-300 shadow-lg transform hover:scale-105 transition-all"
                  >
                    📜 履歴を見る
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
