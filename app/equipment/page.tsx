'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getEquipmentStats, getRarityColor, getRarityLabel } from '@/utils/equipment';
import type { UserEquipment, EquipmentMaster } from '@/types/equipment';

export default function EquipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEquipment, setUserEquipment] = useState<(UserEquipment & { equipment?: EquipmentMaster; equipment_master?: EquipmentMaster })[]>([]);

  useEffect(() => {
    loadEquipment();
  }, []);

  async function loadEquipment() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data } = await supabase
      .from('user_equipment')
      .select(`
        *,
        equipment:equipment_master(*)
      `)
      .eq('user_id', user.id)
      .order('obtained_at', { ascending: false });

    setUserEquipment((data || []) as (UserEquipment & { equipment?: EquipmentMaster; equipment_master?: EquipmentMaster })[]);
    setLoading(false);
  }

  const getSlotName = (slot: string) => {
    switch (slot) {
      case 'weapon': return '武器';
      case 'armor': return '防具';
      case 'accessory': return 'アクセサリ';
      default: return slot;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-600 to-orange-700 p-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="text-white/90 hover:underline mb-4"
        >
          ← ホームに戻る
        </button>

        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">⚔️ 装備一覧</h1>
          <p className="opacity-90">所持している装備 ({userEquipment.length}件)</p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center mb-6">
          <button
            onClick={() => router.push('/equipment/gacha')}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:opacity-90"
          >
            🎰 装備ガチャ（1000pt）
          </button>
          <button
            onClick={() => router.push('/equipment/synthesis')}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:opacity-90"
          >
            ✨ 装備合成
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6 text-gray-900">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {userEquipment.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-800">
                <p className="text-xl mb-2 text-gray-900">装備がありません</p>
                <p className="text-sm text-gray-800">装備ガチャで装備を獲得しよう！</p>
              </div>
            ) : (
              userEquipment.map((ue) => {
                const eq = ue.equipment ?? ue.equipment_master;
                if (!eq) return null;
                const stats = getEquipmentStats(eq, ue.level);
                return (
                  <div
                    key={ue.id}
                    className={`border-2 rounded-xl p-4 bg-gradient-to-br ${getRarityColor(eq.rarity)} bg-opacity-20`}
                  >
                    <div className="text-4xl text-center mb-2">{eq.emoji}</div>
                    <div className="font-bold text-center text-sm text-gray-900">{eq.name}</div>
                    <div className="text-xs text-center text-gray-700 mt-1">
                      {getRarityLabel(eq.rarity)} / {getSlotName(eq.slot_type)} Lv.{ue.level}
                    </div>
                    <div className="mt-2 text-xs space-y-0.5">
                      {stats.atk > 0 && <div>ATK+{stats.atk}</div>}
                      {stats.def > 0 && <div>DEF+{stats.def}</div>}
                      {stats.hp > 0 && <div>HP+{stats.hp}</div>}
                      {stats.spd > 0 && <div>SPD+{stats.spd}</div>}
                    </div>
                    {eq.slot_type === 'weapon' && eq.weapon_skill_type && (
                      <div className="mt-1 text-xs text-amber-600">
                        ⚔️スキル {ue.level >= 5 ? 'Lv.5解放済' : 'Lv.5で解放'}
                      </div>
                    )}
                    {ue.equipped_member_id && (
                      <div className="mt-2 text-xs text-green-600 font-bold text-center">装備中</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
