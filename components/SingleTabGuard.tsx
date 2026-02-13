'use client';

/**
 * アプリ全体を1タブに制限するガード。
 * 複数タブで開いた場合、後から開いたタブには「1つのタブでだけプレイしてください」を表示し操作をブロックする。
 */

import { useEffect, useState, useRef } from 'react';

const STORAGE_KEY = 'hst_single_tab';
const HEARTBEAT_INTERVAL_MS = 2000;
const OWNER_TIMEOUT_MS = 5000;

interface StoredTab {
  tabId: string;
  lastSeen: number;
}

function getStored(): StoredTab | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTab;
    return parsed && typeof parsed.tabId === 'string' && typeof parsed.lastSeen === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function setStored(tabId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabId, lastSeen: Date.now() }));
  } catch {}
}

export default function SingleTabGuard({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const tabIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const myId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    tabIdRef.current = myId;

    function check() {
      const stored = getStored();
      const now = Date.now();

      if (!stored) {
        setStored(myId);
        setBlocked(false);
        return;
      }

      const age = now - stored.lastSeen;

      if (stored.tabId === myId) {
        setStored(myId);
        setBlocked(false);
        return;
      }

      if (age < OWNER_TIMEOUT_MS) {
        setBlocked(true);
        return;
      }

      setStored(myId);
      setBlocked(false);
    }

    check();
    intervalRef.current = setInterval(check, HEARTBEAT_INTERVAL_MS);

    const onUnload = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 text-white p-6">
        <p className="text-xl font-bold mb-4 text-center">
          このゲームは1つのタブでのみプレイできます
        </p>
        <p className="text-base text-gray-300 text-center mb-6">
          他のタブを閉じて、このページを再読み込みしてください。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
