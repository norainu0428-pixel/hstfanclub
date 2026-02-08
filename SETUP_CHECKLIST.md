# HSTファンクラブ 初期セットアップチェックリスト

## ✅ 必須設定

### 1. 環境変数の設定
`.env.local`ファイルに以下を設定してください：
```
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase Anon Key
```

### 2. Supabaseデータベースのセットアップ
Supabase SQL Editorで以下のSQLファイルを順番に実行してください：

#### 基本セットアップ（必須）
- ✅ `supabase_setup.sql` - 基本テーブル（user_members, user_progress, battle_logs, daily_missions等）
- ✅ `supabase_additional_setup.sql` - 追加機能（ガチャ確率、フレンド機能、プロフィール等）
- ✅ `supabase_profile_trigger.sql` - ログイン不具合対策（プロフィール自動作成トリガー）

#### 機能別セットアップ（必要に応じて）
- ✅ `supabase_daily_missions_setup.sql` - デイリーミッション（supabase_setup.sqlに含まれている場合は不要）
- ✅ `supabase_event_gacha_setup.sql` - イベントガチャ機能
- ✅ `supabase_hst_rarity_setup.sql` - HSTレアリティ設定
- ✅ `supabase_pvp_stats.sql` - PvPランキング表示用
- ✅ `supabase_equipment.sql` - 装備システム（装備ガチャ・合成・メンバー装備）
- ✅ `supabase_party_stages.sql` - パーティーモード用ステージ（冒険とは別の10ステージ）
- ✅ `supabase_party_invites.sql` - パーティーモードでフレンド招待（adventure_invites に invite_mode 追加）
- ✅ `supabase_adventure_invites_realtime.sql` - ロビー用リアルタイム同期（adventure_invites を Realtime に追加）

#### オーナー権限の設定（必須）
- ✅ `supabase_set_owner.sql` - 自分のユーザーIDをオーナーに設定
  1. Supabase Dashboard → Authentication → Users で自分のUser UIDをコピー
  2. SQLファイル内の`'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'`を自分のUIDに置き換えて実行

### 3. Discord OAuth設定（Supabase側）
Supabase Dashboard → Authentication → Providers で以下を設定：
- ✅ Discordプロバイダーを有効化
- ✅ Client IDとClient Secretを設定
- ✅ Redirect URLを設定: `http://localhost:3000/auth/callback`（開発環境）
- ✅ Redirect URLを設定: `https://あなたのドメイン/auth/callback`（本番環境）

### 4. プレミアム登録（ユーザーごと）
管理画面（`/admin/users`）で以下を設定：
- ✅ `role`を`'premium'`に設定、または
- ✅ `membership_tier`を`'premium'`に設定
- ✅ 必要に応じて`premium_until`で有効期限を設定

## 📋 動作確認項目

### 新規ユーザーの体験
- ✅ Discordでログインできる
- ✅ プロフィールが自動作成される
- ✅ 初期キャラクター3体（smile, zerom, shunkoro）が自動付与される
- ✅ デイリーミッションが自動初期化される
- ✅ すぐにゲームを開始できる

### 基本機能
- ✅ 冒険に出発できる
- ✅ パーティーモードで遊べる（/party）
- ✅ バトルができる
- ✅ ガチャが引ける
- ✅ デイリーミッションが表示される
- ✅ フレンド機能が使える

### 管理機能
- ✅ 管理画面（`/admin`）にアクセスできる（オーナーのみ）
- ✅ ユーザー管理ができる
- ✅ ポイント配布ができる
- ✅ HST配布ができる

## 🔧 トラブルシューティング

### プロフィールが作成されない / 一部のメンバーがログインできない場合
- `supabase_profile_trigger.sql` を実行（新規ユーザー用プロフィール自動作成トリガー）
- 既存の auth.users にプロフィールがないユーザーも上記SQLで一括作成される
- ログイン後に「プロフィールの設定が必要です」と表示された場合は「プロフィールを作成」ボタンで再試行

### 初期キャラクターが付与されない場合
- `user_members`テーブルが正しく作成されているか確認
- RLSポリシーが正しく設定されているか確認

### Discordログインができない場合
- SupabaseのDiscord OAuth設定を確認
- Redirect URLが正しく設定されているか確認
- Client IDとClient Secretが正しいか確認

### 管理画面にアクセスできない場合
- `supabase_set_owner.sql`を実行してオーナー権限を設定したか確認
- ブラウザをリロードしてセッションを更新

## 📝 注意事項

- 本番環境にデプロイする際は、環境変数を本番用の値に変更してください
- Redirect URLは本番環境のURLに変更してください
- データベースのバックアップを定期的に取ることを推奨します
