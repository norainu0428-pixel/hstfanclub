/**
 * タブ間セッション管理ユーティリティ
 * BroadcastChannel APIを使用して、複数のタブが同時に開かれていることを検出し、
 * 1つのタブだけがアクティブになるようにする
 */

export interface TabSessionMessage {
  type: 'battle_start' | 'battle_end' | 'tab_heartbeat' | 'tab_request_active';
  sessionId: string;
  userId?: string;
  stageId?: number;
  timestamp: number;
}

class TabSessionManager {
  private channel: BroadcastChannel | null = null;
  private sessionId: string;
  private isActiveTab: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private listeners: Map<string, Set<(message: TabSessionMessage) => void>> = new Map();
  private activeBattleSessions: Map<string, { userId: string; stageId: number; timestamp: number }> = new Map();

  constructor() {
    // セッションIDを生成（このタブの一意ID）
    this.sessionId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // BroadcastChannel APIが利用可能かチェック
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('hst_game_session');
      this.setupChannel();
      this.startHeartbeat();
    }
  }

  private setupChannel() {
    if (!this.channel) return;

    this.channel.onmessage = (event: MessageEvent<TabSessionMessage>) => {
      const message = event.data;
      
      // 自分自身のメッセージは無視
      if (message.sessionId === this.sessionId) return;

      // アクティブなバトルセッションを追跡
      if (message.type === 'battle_start') {
        const key = `${message.userId}_${message.stageId}`;
        this.activeBattleSessions.set(key, {
          userId: message.userId || '',
          stageId: message.stageId || 0,
          timestamp: message.timestamp
        });
      } else if (message.type === 'battle_end') {
        const key = `${message.userId}_${message.stageId}`;
        this.activeBattleSessions.delete(key);
      } else if (message.type === 'tab_heartbeat') {
        this.lastHeartbeat = Date.now();
      } else if (message.type === 'tab_request_active') {
        // 他のタブがアクティブを要求している場合、自分がアクティブでないことを通知
        if (this.isActiveTab) {
          this.sendMessage({
            type: 'tab_heartbeat',
            sessionId: this.sessionId,
            timestamp: Date.now()
          });
        }
      }

      // リスナーに通知
      const listeners = this.listeners.get(message.type);
      if (listeners) {
        listeners.forEach(listener => listener(message));
      }
    };

    // ページが閉じられる前にセッションをクリア
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private startHeartbeat() {
    // 5秒ごとにハートビートを送信
    this.heartbeatInterval = setInterval(() => {
      if (this.channel) {
        this.sendMessage({
          type: 'tab_heartbeat',
          sessionId: this.sessionId,
          timestamp: Date.now()
        });
      }
    }, 5000);
  }

  private sendMessage(message: TabSessionMessage) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  /**
   * バトルセッションを開始
   * 他のタブが同じバトルを実行中の場合、falseを返す
   */
  public startBattle(userId: string, stageId: number): boolean {
    const key = `${userId}_${stageId}`;
    const existingSession = this.activeBattleSessions.get(key);
    
    // 他のタブが同じバトルを実行中かチェック（5秒以内のセッションは有効とみなす）
    if (existingSession && Date.now() - existingSession.timestamp < 5000) {
      return false;
    }

    // このタブをアクティブに設定
    this.isActiveTab = true;
    this.activeBattleSessions.set(key, {
      userId,
      stageId,
      timestamp: Date.now()
    });

    // 他のタブに通知
    this.sendMessage({
      type: 'battle_start',
      sessionId: this.sessionId,
      userId,
      stageId,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * バトルセッションを終了
   */
  public endBattle(userId: string, stageId: number) {
    const key = `${userId}_${stageId}`;
    this.activeBattleSessions.delete(key);

    this.sendMessage({
      type: 'battle_end',
      sessionId: this.sessionId,
      userId,
      stageId,
      timestamp: Date.now()
    });
  }

  /**
   * メッセージリスナーを追加
   */
  public onMessage(type: TabSessionMessage['type'], callback: (message: TabSessionMessage) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // クリーンアップ関数を返す
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * 他のタブが同じバトルを実行中かチェック
   */
  public isBattleActive(userId: string, stageId: number): boolean {
    const key = `${userId}_${stageId}`;
    const session = this.activeBattleSessions.get(key);
    if (!session) return false;
    
    // 5秒以内のセッションは有効とみなす
    return Date.now() - session.timestamp < 5000;
  }

  /**
   * クリーンアップ
   */
  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // すべてのアクティブなバトルセッションを終了
    this.activeBattleSessions.forEach((session, key) => {
      const [userId, stageIdStr] = key.split('_');
      const stageId = parseInt(stageIdStr);
      this.endBattle(userId, stageId);
    });

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}

// シングルトンインスタンス
let tabSessionManager: TabSessionManager | null = null;

/**
 * タブセッションマネージャーのインスタンスを取得
 */
export function getTabSessionManager(): TabSessionManager {
  if (!tabSessionManager) {
    tabSessionManager = new TabSessionManager();
  }
  return tabSessionManager;
}
