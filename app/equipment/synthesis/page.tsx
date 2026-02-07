'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getEquipmentStats, getRarityColor } from '@/utils/equipment';
import type { UserEquipment, EquipmentMaster } from '@/types/equipment';

type UserEquipmentWithMaster = UserEquipment & { equipment?: EquipmentMaster; equipment_master?: EquipmentMaster };

export default function EquipmentSynthesisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEquipment, setUserEquipment] = useState<UserEquipmentWithMaster[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [result, setResult] = useState<{ equipment: EquipmentMaster; newLevel: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      .select('*, equipment:equipment_master(*)')
      .eq('user_id', user.id)
      .order('obtained_at', { ascending: false });

    setUserEquipment((data || []) as UserEquipmentWithMaster[]);
    setSelectedIds(new Set());
    setError(null);
    setLoading(false);
  }

  const getMaster = (ue: UserEquipmentWithMaster) => ue.equipment ?? ue.equipment_master;

  /** 同じ装備かつ同じレベルで2つ未装備のものを持つグループ */
  const synthesizableGroups = (() => {
    const groups = new Map<string, UserEquipmentWithMaster[]>();
    for (const ue of userEquipment) {
      if (ue.equipped_member_id) continue;
      const eq = getMaster(ue);
      if (!eq) continue;
      const key = `${ue.equipment_id}_${ue.level}`;
      const arr = groups.get(key) || [];
      arr.push(ue);
      groups.set(key, arr);
    }
    return [...groups.entries()].filter(([, arr]) => arr.length >= 2);
  })();

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canSynthesize(): { ok: boolean; reason?: string } {
    if (selectedIds.size !== 2) return { ok: false, reason: '同じ装備を2つ選択してください' };
    const selected = userEquipment.filter((ue) => selectedIds.has(ue.id));
    const ue1 = selected[0];
    const ue2 = selected[1];
    const eq1 = getMaster(ue1);
    const eq2 = getMaster(ue2);
    if (!eq1 || !eq2) return { ok: false, reason: '装備情報の取得に失敗しました' };
    if (ue1.equipment_id !== ue2.equipment_id || ue1.level !== ue2.level) {
      return { ok: false, reason: '同じ種類・同じレベルの装備を2つ選んでください' };
    }
    if (ue1.equipped_member_id || ue2.equipped_member_id) {
      return { ok: false, reason: '装備中の装備は合成できません' };
    }
    const maxLevel = eq1.max_level ?? 10;
    if (ue1.level >= maxLevel) return { ok: false, reason: `この装備はLv.${maxLevel}が上限です` };
    return { ok: true };
  }

  async function doSynthesize() {
    const check = canSynthesize();
    if (!check.ok) {
      setError(check.reason ?? '合成できません');
      return;
    }

    const selected = userEquipment.filter((ue) => selectedIds.has(ue.id));
    const ue1 = selected[0];
    const eq = getMaster(ue1)!;
    const newLevel = ue1.level + 1;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSynthesizing(true);
    setError(null);

    try {
      const { error: del1 } = await supabase
        .from('user_equipment')
        .delete()
        .eq('id', ue1.id);
      const { error: del2 } = await supabase
        .from('user_equipment')
        .delete()
        .eq('id', selected[1].id);

      if (del1 || del2) {
        setError('合成に失敗しました（削除エラー）');
        return;
      }

      const { error: insertErr } = await supabase
        .from('user_equipment')
        .insert({
          user_id: user.id,
          equipment_id: ue1.equipment_id,
          level: newLevel
        });

      if (insertErr) {
        setError('合成に失敗しました（挿入エラー）');
        return;
      }

      setResult({ equipment: eq, newLevel });
      setSelectedIds(new Set());
      await loadEquipment();
    } finally {
      setIsSynthesizing(false);
    }
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
          onClick={() => router.push('/equipment')}
          className="text-white/90 hover:underline mb-4"
        >
          ← 装備一覧に戻る
        </button>

        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-2">✨ 装備合成</h1>
          <p className="opacity-90">同じ装備を2つ選んでレベルアップ！</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="font-bold text-lg mb-4">合成ルール</h2>
          <ul className="text-gray-700 space-y-1 text-sm">
            <li>• 同じ種類・同じレベルの装備を2つ選ぶと合成できます</li>
            <li>• 合成後は1つになり、レベルが+1されます</li>
            <li>• 装備中の装備は合成できません</li>
            <li>• 各装備には最大レベル（Lv.10）があります</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6 animate-fade-in">
            <h2 className="text-xl font-bold text-center mb-4 text-green-600">🎉 合成成功！</h2>
            <div className={`bg-gradient-to-r ${getRarityColor(result.equipment.rarity)} rounded-xl p-6 text-white text-center`}>
              <div className="text-5xl mb-2">{result.equipment.emoji}</div>
              <div className="font-bold text-xl">{result.equipment.name}</div>
              <div className="text-sm opacity-90">Lv.{result.newLevel}</div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
          <h2 className="font-bold text-lg mb-4">合成可能な装備</h2>
          {synthesizableGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>合成可能な装備のペアがありません</p>
              <p className="text-sm mt-1">同じ装備を2つ以上持っていると合成できます</p>
            </div>
          ) : (
            <div className="space-y-4">
              {synthesizableGroups.map(([key, arr]) => {
                const ue = arr[0];
                const eq = getMaster(ue);
                if (!eq) return null;
                const stats = getEquipmentStats(eq, ue.level);
                const nextStats = getEquipmentStats(eq, ue.level + 1);
                return (
                  <div
                    key={key}
                    className={`border-2 rounded-xl p-4 bg-gradient-to-br ${getRarityColor(eq.rarity)} bg-opacity-10`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="text-3xl">{eq.emoji}</div>
                        <div>
                          <div className="font-bold">{eq.name}</div>
                          <div className="text-sm text-gray-600">
                            {getSlotName(eq.slot_type)} Lv.{ue.level} × {arr.length}個
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2">
                        {arr.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => toggleSelect(item.id)}
                            disabled={isSynthesizing}
                            className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
                              selectedIds.has(item.id)
                                ? 'border-amber-500 bg-amber-100'
                                : 'border-gray-200 hover:border-amber-300'
                            }`}
                          >
                            {selectedIds.has(item.id) ? '✓ 選択中' : '選択'}
                          </button>
                        ))}
                      </div>
                      <div className="text-sm text-gray-600">
                        → Lv.{ue.level + 1} (ATK+{nextStats.atk} DEF+{nextStats.def} HP+{nextStats.hp} SPD+{nextStats.spd})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedIds.size === 2 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={doSynthesize}
                disabled={isSynthesizing || !canSynthesize().ok}
                className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
              >
                {isSynthesizing ? '合成中...' : '✨ 合成する'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => router.push('/equipment')}
            className="text-white/90 hover:underline"
          >
            装備一覧へ →
          </button>
        </div>
      </div>
    </div>
  );
}
