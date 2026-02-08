'use client';
/**
 * 装備画面
 * 実装内容:
 * - 所持装備一覧表示
 * - メンバーごとに武器・防具・アクセサリの装着・変更・外す
 * - 装備ガチャ（1000pt）・装備合成へのリンク
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getRarityLabel } from '@/utils/rarity';
import { useRouter } from 'next/navigation';

type Slot = 'weapon' | 'armor' | 'accessory';
const SLOT_LABELS: Record<Slot, string> = { weapon: '武器', armor: '防具', accessory: 'アクセサリ' };

interface EquipmentDef {
  id: string;
  name: string;
  icon: string;
  slot: Slot;
  rarity: string;
  hp_bonus: number;
  attack_bonus: number;
  defense_bonus: number;
  speed_bonus: number;
}

interface UserEquipmentItem {
  id: string;
  definition_id: string;
  level: number;
  def?: EquipmentDef;
}

interface MemberWithEquip {
  id: string;
  member_name: string;
  member_emoji: string;
  level: number;
  rarity: string;
  weapon?: UserEquipmentItem & { def: EquipmentDef };
  armor?: UserEquipmentItem & { def: EquipmentDef };
  accessory?: UserEquipmentItem & { def: EquipmentDef };
}

export default function EquipmentPage() {
  const router = useRouter();
  const [userEquipList, setUserEquipList] = useState<(UserEquipmentItem & { def: EquipmentDef })[]>([]);
  const [members, setMembers] = useState<MemberWithEquip[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectingSlot, setSelectingSlot] = useState<{ memberId: string; slot: Slot } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('points').eq('user_id', user.id).single();
    setPoints(profile?.points ?? 0);

    const { data: equipData } = await supabase
      .from('user_equipment')
      .select('id, definition_id, level, equipment_definitions(*)')
      .eq('user_id', user.id);
    const list = (equipData || []).map((e: any) => ({
      id: e.id,
      definition_id: e.definition_id,
      level: e.level,
      def: e.equipment_definitions
    })).filter((e: any) => e.def);
    setUserEquipList(list);

    const { data: membersData } = await supabase
      .from('user_members')
      .select('id, member_name, member_emoji, level, rarity')
      .eq('user_id', user.id)
      .order('level', { ascending: false });

    const memberIds = (membersData || []).map((m: { id: string }) => m.id);
    let memberEquipData: any[] | null = null;
    if (memberIds.length > 0) {
      const res = await supabase
        .from('member_equipment')
        .select(`
          user_member_id,
          slot,
          user_equipment(id, definition_id, level, equipment_definitions(*))
        `)
        .in('user_member_id', memberIds);
      memberEquipData = res.data;
    }

    const byMember: Record<string, { weapon?: any; armor?: any; accessory?: any }> = {};
    (memberEquipData || []).forEach((row: any) => {
      const ue = row.user_equipment;
      const def = ue?.equipment_definitions != null
        ? (Array.isArray(ue.equipment_definitions) ? ue.equipment_definitions[0] : ue.equipment_definitions)
        : null;
      if (!def) return;
      const item = {
        id: ue.id,
        definition_id: ue.definition_id,
        level: ue.level,
        def
      };
      if (!byMember[row.user_member_id]) byMember[row.user_member_id] = {};
      byMember[row.user_member_id][row.slot as Slot] = item;
    });

    const membersWithEquip: MemberWithEquip[] = (membersData || []).map((m: any) => ({
      ...m,
      weapon: byMember[m.id]?.weapon,
      armor: byMember[m.id]?.armor,
      accessory: byMember[m.id]?.accessory
    }));
    setMembers(membersWithEquip);
    setLoading(false);
  }

  async function equip(memberId: string, slot: Slot, userEquipmentId: string | null) {
    if (!userEquipmentId) {
      const { data: existing } = await supabase
        .from('member_equipment')
        .select('id')
        .eq('user_member_id', memberId)
        .eq('slot', slot)
        .maybeSingle();
      if (existing) await supabase.from('member_equipment').delete().eq('id', existing.id);
    } else {
      await supabase.from('member_equipment').upsert({
        user_member_id: memberId,
        slot,
        user_equipment_id: userEquipmentId
      }, { onConflict: 'user_member_id,slot' });
    }
    setSelectingSlot(null);
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-orange-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-orange-500">🛡️ 装備</h1>
        <p className="text-gray-400 mb-6">メンバーに装備をつけてステータスを強化しよう</p>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => router.push('/equipment/gacha')}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold hover:opacity-90"
          >
            🎰 装備ガチャ（1000pt）
          </button>
          <button
            onClick={() => router.push('/equipment/synthesis')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-bold hover:opacity-90"
          >
            🔮 装備合成
          </button>
          <span className="py-3 text-gray-300">所持pt: <span className="font-bold text-orange-400">{points}</span></span>
        </div>

        <div className="grid gap-6">
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-xl font-bold mb-3">所持装備 ({userEquipList.length})</h2>
            <div className="flex flex-wrap gap-2">
              {userEquipList.length === 0 ? (
                <p className="text-gray-900">装備がありません。装備ガチャで増やしましょう。</p>
              ) : (
                userEquipList.map((ue) => (
                  <div
                    key={ue.id}
                    className="border border-gray-600 rounded-lg px-3 py-2 flex items-center gap-2 bg-gray-700"
                  >
                    <span className="text-2xl">{ue.def.icon}</span>
                    <div>
                      <div className="font-bold">{ue.def.name}</div>
                      <div className="text-xs text-gray-400">
                        {SLOT_LABELS[ue.def.slot]} | Lv.{ue.level} | HP+{ue.def.hp_bonus} ATK+{ue.def.attack_bonus} DEF+{ue.def.defense_bonus} SPD+{ue.def.speed_bonus}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-xl font-bold mb-3">メンバーと装備スロット</h2>
            <div className="space-y-4">
              {members.map((m) => (
                <div key={m.id} className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{m.member_emoji}</span>
                    <div>
                      <div className="font-bold">{m.member_name}</div>
                      <div className="text-sm text-gray-400">Lv.{m.level} {getRarityLabel(m.rarity)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['weapon', 'armor', 'accessory'] as Slot[]).map((slot) => {
                      const current = m[slot];
                      const isSelecting = selectingSlot?.memberId === m.id && selectingSlot?.slot === slot;
                      return (
                        <div key={slot} className="border border-gray-600 rounded p-2">
                          <div className="text-xs text-gray-400 mb-1">{SLOT_LABELS[slot]}</div>
                          {current ? (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xl">{current.def.icon}</span>
                              <span className="text-sm truncate">{current.def.name}</span>
                              <button
                                onClick={() => setSelectingSlot(isSelecting ? null : { memberId: m.id, slot })}
                                className="text-xs bg-gray-600 px-1 rounded"
                              >
                                {isSelecting ? 'キャンセル' : '変更'}
                              </button>
                              {!isSelecting && (
                                <button onClick={() => equip(m.id, slot, null)} className="text-xs text-red-400">外す</button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectingSlot(isSelecting ? null : { memberId: m.id, slot })}
                              className="text-sm text-gray-900 hover:text-orange-400 w-full text-left"
                            >
                              {isSelecting ? '装備を選ぶ ▼' : '+ 装備する'}
                            </button>
                          )}
                          {isSelecting && (
                            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                              {userEquipList
                                .filter((ue) => ue.def.slot === slot)
                                .map((ue) => (
                                  <button
                                    key={ue.id}
                                    onClick={() => equip(m.id, slot, ue.id)}
                                    className="block w-full text-left text-sm px-2 py-1 bg-gray-600 rounded hover:bg-gray-500"
                                  >
                                    {ue.def.icon} {ue.def.name} Lv.{ue.level}
                                  </button>
                                ))}
                              {userEquipList.filter((ue) => ue.def.slot === slot).length === 0 && (
                                <p className="text-xs text-gray-900">該当スロットの装備がありません</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {members.length === 0 && <p className="text-gray-900">メンバーがいません。冒険やガチャでメンバーを増やしましょう。</p>}
          </div>
        </div>

        <div className="mt-6">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">← トップに戻る</button>
        </div>
      </div>
    </div>
  );
}
