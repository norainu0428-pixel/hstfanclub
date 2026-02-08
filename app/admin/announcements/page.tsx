'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAndLoad();
  }, []);

  async function checkAndLoad() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profile?.role !== 'owner') {
      router.push('/');
      return;
    }
    setIsOwner(true);
    await loadAnnouncements();
    setLoading(false);
  }

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setList((data as Announcement[]) || []);
  }

  function startNew() {
    setEditingId(null);
    setFormTitle('');
    setFormBody('');
    setFormPinned(false);
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setFormTitle(a.title);
    setFormBody(a.body);
    setFormPinned(a.is_pinned ?? false);
  }

  async function save() {
    if (!formTitle.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    setSaving(true);
    const payload = {
      title: formTitle.trim(),
      body: formBody.trim(),
      is_pinned: formPinned,
      updated_at: new Date().toISOString()
    };
    if (editingId) {
      const { error } = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        alert('更新に失敗しました: ' + error.message);
      } else {
        setEditingId(null);
        setFormTitle('');
        setFormBody('');
        setFormPinned(false);
        await loadAnnouncements();
      }
    } else {
      const { error } = await supabase.from('announcements').insert(payload);
      if (error) {
        alert('登録に失敗しました: ' + error.message);
      } else {
        setFormTitle('');
        setFormBody('');
        setFormPinned(false);
        await loadAnnouncements();
      }
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm('このお知らせを削除しますか？')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      await loadAnnouncements();
      if (editingId === id) {
        setEditingId(null);
        setFormTitle('');
        setFormBody('');
        setFormPinned(false);
      }
    }
  }

  if (!isOwner && !loading) return null;
  if (loading) {
    return (
      <AdminLayout>
        <div className="text-gray-900">読み込み中...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="text-gray-900">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">📢 お知らせ管理</h1>

        {/* 新規作成 / 編集フォーム */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">
            {editingId ? 'お知らせを編集' : '新規お知らせ'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">タイトル</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
                placeholder="お知らせのタイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-900">本文</label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={5}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white"
                placeholder="お知らせの本文"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={formPinned}
                onChange={(e) => setFormPinned(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="pinned" className="text-gray-900">トップに固定表示</label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : editingId ? '更新' : '登録'}
              </button>
              {editingId && (
                <button
                  onClick={startNew}
                  className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-bold hover:bg-gray-300"
                >
                  キャンセル
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 一覧 */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900">お知らせ一覧</h2>
          {list.length === 0 ? (
            <p className="text-gray-700">お知らせはまだありません。</p>
          ) : (
            <ul className="space-y-4">
              {list.map((a) => (
                <li
                  key={a.id}
                  className="border-2 border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900">{a.title}</h3>
                        {a.is_pinned && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">固定</span>
                        )}
                      </div>
                      <p className="text-gray-700 mt-1 whitespace-pre-wrap">{a.body}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(a.created_at).toLocaleString('ja-JP')}
                        {a.updated_at !== a.created_at && `（更新: ${new Date(a.updated_at).toLocaleString('ja-JP')}）`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(a)}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-bold text-sm hover:bg-blue-200"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded font-bold text-sm hover:bg-red-200"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
