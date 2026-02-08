'use client';
/**
 * 装備合成
 * 実装内容: 同じ種類の装備3つで合成し、1つにまとめてLvアップ（最大Lv5）。
 * 装着中装備は解除してから合成。
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const SLOT_LABELS: Record<string, string> = { weapon: '武器', armor: '防具', accessory: 'アクセサリ' };
const SYNTHESIS_COUNT = 3; // 3体で合成
const MAX_LEVEL = 5;

export default function EquipmentSynthesisPage() {
  const router = useRouter();
  const [userEquipList, setUserEquipList] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    const { data } = await supabase
      .from('user_equipment')
      .select('id, definition_id, level, equipment_definitions(*)')
      .eq('user_id', user.id);
    const list = (data || []).map((e: any) => ({
      id: e.id,
      definition_id: e.definition_id,
      level: e.level,
      def: Array.isArray(e.equipment_definitions) ? e.equipment_definitions[0] : e.equipment_definitions
    })).filter((e: any) => e.def);
    setUserEquipList(list);
    setSelected([]);
    setLoading(false);
  }

  function toggle(id: string) {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else if (selected.length < SYNTHESIS_COUNT) {
      setSelected([...selected, id]);
    }
  }

  async function synthesize() {
    if (selected.length !== SYNTHESIS_COUNT) {
      alert(`同じ種類の装備を${SYNTHESIS_COUNT}つ選んでください`);
      return;
    }
    const selectedItems = userEquipList.filter((e) => selected.includes(e.id));
    const definitionIds = [...new Set(selectedItems.map((e) => e.definition_id))];
    if (definitionIds.length > 1) {
      alert('同じ種類の装備を選んでください（同じ名前の装備3つ）');
      return;
    }
    const defId = definitionIds[0];
    const maxLevel = Math.max(...selectedItems.map((e) => e.level));
    const newLevel = Math.min(MAX_LEVEL, maxLevel + 1);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSynthesizing(true);

    const { error: delErr } = await supabase
      .from('member_equipment')
      .delete()
      .in('user_equipment_id', selected);
    if (delErr) {
      setSynthesizing(false);
      alert('装備解除の処理でエラー: ' + delErr.message);
      return;
    }

    const { error: deleteError } = await supabase
      .from('user_equipment')
      .delete()
      .in('id', selected);

    if (deleteError) {
      setSynthesizing(false);
      alert('合成に失敗しました: ' + deleteError.message);
      return;
    }

    const { error: insertError } = await supabase
      .from('user_equipment')
      .insert({ user_id: user.id, definition_id: defId, level: newLevel })
      .select()
      .single();

    if (insertError) {
      setSynthesizing(false);
      alert('合成結果の付与に失敗しました: ' + insertError.message);
      return;
    }

    setSynthesizing(false);
    alert(`合成成功！ Lv.${newLevel} の装備を獲得しました。`);
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-orange-500">読み込み中...</p>
      </div>
    );
  }

  const selectedItems = userEquipList.filter((e) => selected.includes(e.id));
  const sameKind = selected.length === SYNTHESIS_COUNT && [...new Set(selectedItems.map((e) => e.definition_id))].length === 1;
  const nextLevel = sameKind
    ? Math.min(MAX_LEVEL, Math.max(...selectedItems.map((e) => e.level)) + 1)
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-orange-500">🔮 装備合成</h1>
        <p className="text-gray-400 mb-6">同じ種類の装備3つで、1つの装備に強化（Lv.アップ、最大Lv.{MAX_LEVEL}）</p>

        <div className="mb-6 p-4 bg-gray-800 rounded-xl">
          <p className="text-sm text-gray-400 mb-2">選択中: {selected.length}/{SYNTHESIS_COUNT}</p>
          {sameKind && nextLevel != null && (
            <p className="text-green-400 font-bold">→ Lv.{nextLevel} の装備が1つできます</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {userEquipList.map((ue) => {
            const isSelected = selected.includes(ue.id);
            const canSelect = isSelected || selected.length < SYNTHESIS_COUNT;
            return (
              <button
                key={ue.id}
                onClick={() => canSelect && toggle(ue.id)}
                className={`border-2 rounded-lg px-4 py-3 flex items-center gap-2 transition ${
                  isSelected ? 'border-orange-500 bg-orange-500/20' : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                } ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="text-2xl">{ue.def.icon}</span>
                <div className="text-left">
                  <div className="font-bold">{ue.def.name}</div>
                  <div className="text-xs text-gray-400">{SLOT_LABELS[ue.def.slot]} Lv.{ue.level}</div>
                </div>
                {isSelected && <span className="text-orange-400">✓</span>}
              </button>
            );
          })}
        </div>
        {userEquipList.length < SYNTHESIS_COUNT && (
          <p className="text-gray-500 mb-4">装備が{SYNTHESIS_COUNT}つ以上必要です。装備ガチャで増やしましょう。</p>
        )}

        <button
          onClick={synthesize}
          disabled={!sameKind || synthesizing}
          className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {synthesizing ? '合成中...' : '🔮 合成する'}
        </button>

        <div className="mt-6 text-center">
          <button onClick={() => router.push('/equipment')} className="text-gray-400 hover:text-white">← 装備に戻る</button>
        </div>
      </div>
    </div>
  );
}
