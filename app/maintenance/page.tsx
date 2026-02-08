'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MaintenancePage() {
  const [message, setMessage] = useState('只今メンテナンス中です。しばらくお待ちください。');

  useEffect(() => {
    supabase
      .from('maintenance_mode')
      .select('message')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.message) setMessage(data.message);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8">
      <div className="text-6xl mb-6">🔧</div>
      <h1 className="text-3xl font-bold mb-4 text-orange-500">メンテナンス中</h1>
      <p className="text-xl text-gray-300 text-center max-w-md mb-8">{message}</p>
      <p className="text-sm text-gray-500">しばらくお待ちください。ご不便をおかけして申し訳ございません。</p>
    </div>
  );
}
