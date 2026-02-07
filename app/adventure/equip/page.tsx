'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getEquipmentStats, getRarityColor } from '@/utils/equipment';
import type { UserEquipment, EquipmentMaster } from '@/types/equipment';
import type { Member } from '@/types/adventure';
import { getPlateImageUrl } from '@/utils/plateImage';
import Image from 'next/image';

type UserEquipmentWithMaster = UserEquipment & { equipment?: EquipmentMaster; equipment_master?: EquipmentMaster };

const SLOT_LABELS: Record<string, string> = { weapon: '武器', armor: '防具', accessory: 'アクセサリ' };

export default function AdventureEquipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [userEquipment, setUserEquipment] = useState<UserEquipmentWithMaster[]>([]);
  const [selectingFor, setSelectingFor] = useState<{ memberId: string; slotType: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const [membersRes, equipRes] = await Promise.all([
      supabase.from('user_members').select('*').eq('user_id', user.id).order('level', { ascending: false }),
      supabase.from('user_equipment').select('*, equipment:equipment_master(*)').eq('user_id', user.id)
    ]);

    setMembers((membersRes.data || []) as Member[]);
    setUserEquipment((equipRes.data || []) as UserEquipmentWithMaster[]);
    setSelectingFor(null);
    setLoading(false);
  }

  const getMaster = (ue: UserEquipmentWithMaster) => ue.equipment ?? ue.equipment_master;

  function getEquippedForMember(memberId: string, slotType: string): UserEquipmentWithMaster | null {
    return userEquipment.find(
      ue => ue.equipped_member_id === memberId && getMaster(ue)?.slot_type === slotType
    ) ?? null;
  }

  function getEquippableList(slotType: string): UserEquipmentWithMaster[] {
    return userEquipment.filter(ue => {
      const eq = getMaster(ue);
      return eq?.slot_type === slotType;
    });
  }

  async function equip(memberId: string, slotType: string, userEquipmentId: string | null) {
    if (saving) return;
    setSaving(userEquipmentId || 'unequip');

    const current = getEquippedForMember(memberId, slotType);
    if (current && current.id !== userEquipmentId) {
      await supabase
        .from('user_equipment')
        .update({ equipped_member_id: null })
        .eq('id', current.id);
    }
    if (userEquipmentId) {
      await supabase
        .from('user_equipment')
        .update({ equipped_member_id: memberId })
        .eq('id', userEquipmentId);
    }

    await loadData();
    setSelectingFor(null);
    setSaving(null);
  }

  async function unequip(memberId: string, slotType: string) {
    const current = getEquippedForMember(memberId, slotType);
    if (!current) return;
    if (saving) return;
    setSaving(current.id);
    await supabase.from('user_equipment').update({ equipped_member_id: null }).eq('id', current.id);
    await loadData();
    setSelectingFor(null);
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  const slotTypes = ['weapon', 'armor', 'accessory'] as const;
  const isSelecting = selectingFor !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/adventure')}
          className="text-orange-400 hover:underline mb-4"
        >
          ← パーティ編成に戻る
        </button>

        <h1 className="text-3xl font-bold text-white mb-2 text-center">⚔️ 装備</h1>
        <p className="text-gray-400 text-center mb-6">キャラクターに装備を装着できます</p>

        <div className="space-y-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-gray-800/80 border border-orange-500/30 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start"
            >
              <div className="flex items-center gap-3 shrink-0">
                {getPlateImageUrl(member.member_name, member.rarity || 'common') ? (
                  <div className="w-16 h-16 relative rounded-lg overflow-hidden">
                    <Image
                      src={getPlateImageUrl(member.member_name, member.rarity || 'common')!}
                      alt={member.member_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <span className="text-4xl">{member.member_emoji}</span>
                )}
                <div>
                  <div className="font-bold text-white">{member.member_name}</div>
                  <div className="text-sm text-gray-400">Lv.{member.level}</div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {slotTypes.map((slotType) => {
                  const equipped = getEquippedForMember(member.id, slotType);
                  const eq = equipped ? getMaster(equipped) : null;
                  const isThisSelecting = selectingFor?.memberId === member.id && selectingFor?.slotType === slotType;
                  const list = isThisSelecting ? getEquippableList(slotType) : [];

                  return (
                    <div key={slotType} className="bg-gray-900/80 rounded-lg p-3 border border-gray-600">
                      <div className="text-xs text-gray-500 mb-2">{SLOT_LABELS[slotType]}</div>
                      {equipped && eq ? (
                        <div className={`rounded-lg p-2 bg-gradient-to-r ${getRarityColor(eq.rarity)} bg-opacity-20 border border-gray-600`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-lg">{eq.emoji}</span>
                            <span className="text-sm font-bold text-white truncate">{eq.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Lv.{equipped.level}</div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setSelectingFor({ memberId: member.id, slotType })}
                              disabled={saving !== null}
                              className="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
                            >
                              変更
                            </button>
                            <button
                              onClick={() => unequip(member.id, slotType)}
                              disabled={saving !== null}
                              className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-900/70"
                            >
                              外す
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            onClick={() => setSelectingFor({ memberId: member.id, slotType })}
                            disabled={saving !== null}
                            className="w-full py-2 rounded-lg border border-dashed border-gray-500 text-gray-400 hover:border-orange-500 hover:text-orange-400 text-sm"
                          >
                            未装備 - 選択
                          </button>
                        </div>
                      )}

                      {isThisSelecting && (
                        <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                          <div className="text-xs text-gray-500">装備を選ぶ</div>
                          {list.map((ue) => {
                            const m = getMaster(ue);
                            if (!m) return null;
                            const isEquippedHere = ue.equipped_member_id === member.id;
                            const isEquippedElse = !!(ue.equipped_member_id && ue.equipped_member_id !== member.id);
                            return (
                              <button
                                key={ue.id}
                                onClick={() => equip(member.id, slotType, ue.id)}
                                disabled={saving !== null || isEquippedElse}
                                className={`w-full text-left rounded p-2 text-sm flex items-center gap-2 ${getRarityColor(m.rarity)} bg-opacity-20 border ${isEquippedElse ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}
                              >
                                <span>{m.emoji}</span>
                                <span className="font-medium text-white">{m.name}</span>
                                <span className="text-gray-400 text-xs">Lv.{ue.level}</span>
                                {isEquippedHere && <span className="text-xs text-green-400 ml-auto">装備中</span>}
                              </button>
                            );
                          })}
                          {list.length === 0 && (
                            <div className="text-sm text-gray-500">該当する装備がありません</div>
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

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/equipment')}
            className="text-orange-400 hover:underline"
          >
            装備一覧・ガチャへ →
          </button>
        </div>
      </div>
    </div>
  );
}
