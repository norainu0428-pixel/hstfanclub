'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function PremiumPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, premium_until')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // ownerは常にアクセス可能
        if (profile.role === 'owner') {
          setAuthorized(true);
        } 
        // premiumの場合はpremium_untilをチェック
        else if (profile.role === 'premium') {
          if (profile.premium_until) {
            const premiumDate = new Date(profile.premium_until);
            const today = new Date();
            setAuthorized(premiumDate > today);
          } else {
            setAuthorized(false);
          }
        } else {
          setAuthorized(false);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('エラー:', error);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>読み込み中...</p>
      </div>
    );
  }
  
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">プレミアム会員限定</h1>
          <p className="mb-4">このページはプレミアム会員専用です</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            トップに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">プレミアム限定ページ</h1>
        <p className="text-gray-900 mb-8">プレミアム会員の特典ページです</p>
        
        <div className="grid gap-4">
          <section className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-3">🎰 プレミアム限定ガチャ</h2>
            <p className="mb-4 opacity-90">
              レア確率5倍！レジェンド出現率5%！
              <br />
              ガチャを回してポイントをゲット！
            </p>
            <button
              onClick={() => router.push('/premium/gacha')}
              className="bg-white text-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition"
            >
              ガチャで遊ぶ
            </button>
          </section>
          
          <section className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">限定壁紙ダウンロード</h2>
            <p className="text-gray-900">※後で実装予定</p>
          </section>
          
          <section className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">限定ヘッダー</h2>
            <p className="text-gray-900">※後で実装予定</p>
          </section>
          
          <section className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">アイコンリング</h2>
            <p className="text-gray-900">※後で実装予定</p>
          </section>
        </div>
        
        <button 
          onClick={() => router.push('/')}
          className="mt-8 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          トップに戻る
        </button>
      </div>
    </div>
  );
}
