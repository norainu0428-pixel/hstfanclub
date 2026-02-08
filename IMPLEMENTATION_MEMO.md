# 実装メモ（日本語）

このドキュメントは、プロジェクトに追加・修正した機能を日本語でまとめたメモです。

## 目次

1. [ログイン・認証まわり](#1-ログイン認証まわり)
2. [メンテナンス機能（運営用）](#2-メンテナンス機能運営用)
3. [運営からのお知らせ機能](#3-運営からのお知らせ機能)
4. [ランキング](#4-ランキング)
5. [通常ガチャの権限](#5-通常ガチャの権限)
6. [イベントガチャ（オーナー専用）](#6-イベントガチャオーナー専用)
7. [オートバトル](#7-オートバトル)
8. [装備システム](#8-装備システム)
9. [その他](#9-その他)
10. [パーティーモード](#10-パーティーモード)

---

## 1. ログイン・認証まわり

### 1.1 Discord ログイン（本番対応）
- **場所**: `app/page.tsx`
- **内容**: `redirectTo` を `window.location.origin + '/auth/callback'` に変更。本番ドメインでも正しくコールバックする。

### 1.2 認証コールバックのエラー処理
- **場所**: `app/auth/callback/route.ts`
- **内容**: OAuth の `error` / `error_description` や `exchangeCodeForSession` 失敗時に、`/?auth_error=...` でトップへリダイレクト。トップでエラーメッセージを表示。

### 1.3 プロフィール未作成時の対応
- **場所**: `app/page.tsx`
- **内容**: ログイン済みだがプロフィールがない場合、「プロフィールの設定が必要です」画面を表示。「プロフィールを作成」で再試行、display_name に `global_name` も使用。

### 1.4 プロフィール自動作成トリガー
- **場所**: `supabase_profile_trigger.sql`
- **内容**: `auth.users` に新規ユーザーが追加されたら `profiles` を自動作成。既存の `auth.users` のうちプロフィールがないユーザーにも一括でプロフィール作成。ログインできないメンバー対策。

---

## 2. メンテナンス機能（運営用）

サイト全体を一時的に停止したいときに使用。一般ユーザーはアクセス不可、オーナー・スタッフは継続して利用可能。

### 2.1 システム設定テーブル
- **場所**: `supabase_system_settings.sql`
- **内容**: `system_settings` テーブル（key-value）。`maintenance_mode` で `{"enabled": true/false}` を保存。全員が読める、オーナーのみ更新可能。

### 2.2 メンテナンスゲート
- **場所**: `components/MaintenanceGate.tsx`、`app/layout.tsx`
- **内容**: 全ページの表示前に `maintenance_mode` を確認。有効かつオーナー・スタッフでない場合は「メンテナンス中」画面を表示。オーナー・スタッフはそのまま利用可能。

### 2.3 管理画面でのメンテナンスON/OFF
- **場所**: `app/admin/settings/page.tsx`
- **内容**: メンテナンスモードのトグルボタン。ON/OFF で `system_settings` を更新。

### 2.4 使い方
1. Supabase SQL Editor で `supabase_system_settings.sql` を実行
2. 管理画面（`/admin/settings`）→「🔧 メンテナンスモード」
3. ボタンで「メンテナンス中」「通常稼働」を切り替え

---

## 3. 運営からのお知らせ機能

運営がユーザー向けにお知らせを投稿・管理する機能。トップページに表示される。

### 3.1 お知らせテーブル
- **場所**: `supabase_announcements.sql`
- **内容**: `announcements`（title, body, is_active, created_by 等）。アクティブなお知らせは全員が閲覧可能。オーナー・スタッフが全件管理可能。

### 3.2 トップでのお知らせ表示
- **場所**: `app/page.tsx`
- **内容**: `announcements` の `is_active=true` を取得し、タイトル・本文を表示。ログイン前・ログイン後どちらでも表示。

### 3.3 管理画面でのお知らせ編集
- **場所**: `app/admin/settings/page.tsx`（AnnouncementsEditor）
- **内容**: お知らせの追加・表示/非表示切り替え・削除。

### 3.4 使い方
1. Supabase SQL Editor で `supabase_announcements.sql` を実行
2. 管理画面（`/admin/settings`）→「📢 お知らせ管理」
3. タイトル・本文を入力して「追加」
4. 「表示中」「非表示」で表示可否を切り替え。「削除」でお知らせを削除

---

## 4. ランキング

### 4.1 PvPランキング用テーブル
- **場所**: `supabase_pvp_stats.sql`
- **内容**: `pvp_stats`（user_id, rating, wins, losses, total_battles）。`update_pvp_stats(p_user_id, p_won)` の RPC で勝敗を反映。全員が読める、自分だけ更新可能。

### 4.2 ランキングページ
- **場所**: `app/ranking/page.tsx`
- **内容**: `pvp_stats` で Top100 取得。`profiles` は別クエリで display_name を取得（FK 結合に依存しない形で表示）。自分の順位も表示。

### 4.3 トップ・ゲームページからのリンク
- **場所**: `app/page.tsx`、`app/games/page.tsx`
- **内容**: 「ランキングを見る」「ランキング」カードで `/ranking` へ誘導。

---

## 5. 通常ガチャの権限

### 5.1 全ユーザーが利用可能に変更
- **場所**: `app/basic/gacha/page.tsx`
- **内容**: `premium_until` チェックを削除。ログイン済みなら誰でも通常ガチャ（30pt/270pt）を利用可能。

### 5.2 ゲームページの通常ガチャカード
- **場所**: `app/games/page.tsx`
- **内容**: 通常ガチャカードを membership_tier に関係なく全員に表示。

---

## 6. イベントガチャ（オーナー専用）

### 6.1 表示・アクセス制限
- **場所**: `app/page.tsx`、`app/events/page.tsx`
- **内容**: トップの「イベントガチャ」ボタンは `profile.role === 'owner'` のときのみ表示。`/events` はオーナー以外はトップへリダイレクト。

---

## 7. オートバトル

### 7.1 オートモード
- **場所**: `app/adventure/battle/page.tsx`
- **内容**: `isAutoMode` 状態を追加。ON のとき、プレイヤーターンで生存メンバー1体目が敵1体目に自動で通常攻撃。ヘッダーに「オート OFF / オート ON」ボタンを表示。

---

## 8. 装備システム

### 8.1 装備用テーブル
- **場所**: `supabase_equipment.sql`
- **内容**:
  - `equipment_definitions`: 装備マスタ（名前、アイコン、スロット、レアリティ、HP/ATK/DEF/SPD ボーナス）
  - `user_equipment`: ユーザーが所持する装備（ガチャで増やす、level 1〜5）
  - `member_equipment`: メンバーごとの装着（user_member_id, slot, user_equipment_id）。スロットは weapon / armor / accessory の3種。

### 8.2 装備画面
- **場所**: `app/equipment/page.tsx`
- **内容**: 所持装備一覧、メンバーごとに武器・防具・アクセサリの装着・変更・外す。装備ガチャ・装備合成へのリンク。

### 8.3 装備ガチャ
- **場所**: `app/equipment/gacha/page.tsx`
- **内容**: 1回 1000pt で装備を1つ獲得。レアリティは common〜legendary で重み付きランダム。

### 8.4 装備合成
- **場所**: `app/equipment/synthesis/page.tsx`
- **内容**: 同じ種類の装備3つで合成し、1つにまとめて Lv アップ（最大 Lv5）。装着中は解除してから合成。

### 8.5 バトルでの装備ボーナス
- **場所**: `app/adventure/battle/page.tsx`（initBattle 内）
- **内容**: パーティメンバーの `member_equipment` → `user_equipment` → `equipment_definitions` を取得し、HP/ATK/DEF/SPD を加算した状態で戦闘開始。

### 8.6 導線
- **場所**: `app/page.tsx`、`app/games/page.tsx`
- **内容**: トップに「🛡️ 装備」ボタン、ゲームページに「装備」カード（装備ガチャ 1000pt の案内）を追加。

---

## 9. その他

### 9.1 ゲームページの PvP・ランキング
- **場所**: `app/games/page.tsx`
- **内容**: PvP対戦・ランキングのカードを追加。ゲーム一覧から遷移可能。

### 9.2 セットアップチェックリスト
- **場所**: `SETUP_CHECKLIST.md`
- **内容**: プロフィールトリガー、PvPランキング、装備システムなどの SQL 実行手順を追記。

---

## SQL ファイル一覧（実行順の目安）

1. `supabase_setup.sql` - 基本テーブル
2. `supabase_additional_setup.sql` - ガチャ・フレンド・ミッション等
3. `supabase_profile_trigger.sql` - ログイン不具合対策（プロフィール自動作成）
4. `supabase_system_settings.sql` - メンテナンスモード
5. `supabase_announcements.sql` - お知らせ
6. `supabase_pvp_stats.sql` - PvPランキング
7. `supabase_equipment.sql` - 装備システム
8. `supabase_party_stages.sql` - パーティーモード用ステージ

---

## 10. パーティーモード

冒険モード（1〜400ステージ）とは別に、パーティーモード専用のステージを用意。同じバトルシステムを使用しつつ、独立したステージ構成で遊べる。

### 10.1 パーティーステージテーブル
- **場所**: `supabase_party_stages.sql`
- **内容**: `party_stages`（id, stage_order, name, description, recommended_level, enemies JSONB, exp_reward, points_reward, is_active）。冒険の進行とは無関係。初期データとして10ステージを INSERT。

### 10.2 パーティーモードページ
- **場所**: `app/party/page.tsx` - パーティー編成（最大3体選択）
- **場所**: `app/party/stages/page.tsx` - ステージ一覧
- **場所**: `app/party/stage/[id]/page.tsx` - ステージ詳細・戦闘開始

### 10.3 バトルページのパーティーモード対応
- **場所**: `app/adventure/battle/page.tsx`
- **内容**: `party_stage_id` クエリがある場合、`party_stages` から敵データを取得。勝利時は冒険の進行を更新せず、遷移先は「ステージ一覧へ」「パーティ編成に戻る」。敗北時はリトライで同じパーティステージへ。

### 10.4 導線
- **場所**: `app/page.tsx`、`app/games/page.tsx`
- **内容**: トップに「🎪 パーティーモード」ボタン、ゲームページにパーティーモードカードを追加。

### 10.5 使い方
1. Supabase SQL Editor で `supabase_party_stages.sql` を実行
2. トップまたはゲームページから「パーティーモード」へ
3. パーティー編成（最大3体）→ ステージ選択 → 戦闘開始

以上、実装した機能の日本語メモです。
