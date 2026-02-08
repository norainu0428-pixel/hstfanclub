'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarCacheBust, setAvatarCacheBust] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    let data: { user_id: string; display_name: string | null; avatar_url?: string | null } | null = null;
    const { data: full } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (full) {
      data = full;
    } else {
      const { data: minimal } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      data = minimal;
    }
    if (data) {
      setProfile({ user_id: data.user_id, display_name: data.display_name, avatar_url: data.avatar_url ?? null });
      setDisplayName(data.display_name ?? '');
      setAvatarUrl(data.avatar_url ?? null);
    }
    setLoading(false);
  }

  async function saveDisplayName() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('user_id', profile.user_id);
    if (error) {
      alert('保存に失敗しました: ' + error.message);
    }
    setSaving(false);
  }

  const uploadAvatar = useCallback(async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      alert('対応形式: JPEG, PNG, GIF, WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('ファイルサイズは2MB以下にしてください');
      return;
    }
    setUploading(true);
    // 毎回ユニークなパスでアップロード（キャッシュで古いアイコンが残るのを防ぐ）
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: false });
    if (uploadError) {
      alert('アップロードに失敗しました: ' + uploadError.message + '\n\nSupabase Dashboard → Storage で avatars バケットを作成（public=true）してください。');
      setUploading(false);
      return;
    }
    // 古いアバターを削除（ストレージ整理、アップロード成功時のみ）
    const newFileName = path.split('/')[1];
    const { data: oldFiles } = await supabase.storage.from('avatars').list(user.id);
    if (oldFiles?.length) {
      const toRemove = oldFiles
        .filter((f) => f.name && f.name !== newFileName)
        .map((f) => `${user.id}/${f.name}`);
      if (toRemove.length) await supabase.storage.from('avatars').remove(toRemove);
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = urlData.publicUrl;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('user_id', user.id);
    if (updateError) {
      alert('プロフィール更新に失敗しました: ' + updateError.message + '\n\nsupabase_profile_avatar.sql を実行して avatar_url カラムを追加してください。');
    } else {
      setAvatarUrl(url);
      setAvatarCacheBust(Date.now());
      setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
    }
    setUploading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      uploadAvatar(file);
    } else {
      alert('画像ファイルをドロップしてください');
    }
  }, [uploadAvatar]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-orange-500">読み込み中...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-orange-500">プロフィールが見つかりません</p>
        <button onClick={() => router.push('/')} className="ml-4 text-orange-400 underline">トップへ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-orange-500">プロフィール編集</h1>

        {/* アバター（ドラッグ&ドロップ） */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-2 text-gray-300">アイコン</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('avatar-input')?.click()}
            className={`
              relative w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden
              transition-colors
              ${dragOver ? 'border-orange-500 bg-orange-500/20' : 'border-gray-600 hover:border-orange-500/50'}
            `}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl + (avatarCacheBust ? '?t=' + avatarCacheBust : '')}
                alt="アバター"
                className="w-full h-full object-cover pointer-events-none"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-4xl text-gray-500 pointer-events-none">+</span>
            )}
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
              className="sr-only"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            画像をドロップするかクリックして選択（2MB以下、JPEG/PNG/GIF/WebP）
          </p>
          {uploading && <p className="text-orange-500 text-sm mt-1">アップロード中...</p>}
        </div>

        {/* 表示名 */}
        <div className="mb-8">
          <label className="block text-sm font-bold mb-2 text-gray-300">表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={saveDisplayName}
            className="w-full border-2 border-gray-700 bg-gray-900 rounded-lg px-4 py-3 text-white"
            placeholder="表示名"
          />
          {saving && <p className="text-orange-500 text-sm mt-1">保存中...</p>}
        </div>

        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 border border-gray-600"
        >
          トップへ戻る
        </button>
      </div>
    </div>
  );
}
