# Vercel 404エラー トラブルシューティングガイド

## ✅ 現在の構造確認結果

### 1. ファイル構造（問題なし）
- ✅ `app`フォルダがルートに存在する
- ✅ `app/page.tsx`が存在し、正しく`export default function Home()`でエクスポートされている
- ✅ `app/layout.tsx`が存在し、ルートレイアウトが正しく設定されている
- ✅ プロジェクトはルートディレクトリに直接配置されている（サブディレクトリではない）

### 2. Next.js設定（問題なし）
- ✅ `next.config.ts`に`basePath`などの制限設定はない
- ✅ `output`設定による出力先の制限もない
- ✅ `trailingSlash`などのルーティング制限もない

### 3. エクスポート（問題なし）
- ✅ `app/page.tsx`は`export default function Home()`で正しくエクスポートされている
- ✅ `app/layout.tsx`は`export default function RootLayout()`で正しくエクスポートされている

## 🔍 Vercelで404が出る場合の確認事項

### 1. Vercelのプロジェクト設定を確認

Vercelダッシュボードで以下を確認してください：

1. **Settings → General → Root Directory**
   - 空（または`.`）になっているか確認
   - もし`src`などが設定されている場合は、空にするか`.`に変更

2. **Settings → General → Build & Development Settings**
   - Framework Preset: `Next.js`が選択されているか
   - Build Command: `npm run build`（または`next build`）が設定されているか
   - Output Directory: 空（Next.jsが自動で`.next`を使用）

### 2. ビルドログの確認

Vercelのデプロイログで以下を確認してください：

1. **ビルドが成功しているか**
   - ビルドログにエラーがないか確認
   - 特に「Cannot find module」や「File not found」などのエラーがないか

2. **`app/page.tsx`が正しく認識されているか**
   - ビルドログに`app/page.tsx`が含まれているか確認
   - ルートページが正しくビルドされているか確認

3. **ルーティングが正しく生成されているか**
   - ビルドログに`Route (app)`のセクションがあるか確認
   - `/`ルートが正しく生成されているか確認

### 3. 環境変数の確認

Vercelの環境変数で、以下が正しく設定されているか確認してください：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. ローカルでビルドをテスト

以下のコマンドでローカルでビルドをテストしてください：

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 本番モードで起動
npm run start
```

ローカルで`http://localhost:3000`にアクセスして、ページが表示されるか確認してください。

### 5. VercelのFunctionsログを確認

Vercelダッシュボードの**Functions**タブで、エラーが発生していないか確認してください。

## 🛠️ 推奨される修正手順

### ステップ1: Vercelの設定をリセット

1. Vercelダッシュボードでプロジェクトを開く
2. **Settings → General → Root Directory**を空にする
3. **Settings → General → Build & Development Settings**で以下を確認：
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`（または空欄で自動検出）
   - Output Directory: 空欄（自動検出）

### ステップ2: 再デプロイ

1. Vercelダッシュボードで**Deployments**タブを開く
2. 最新のデプロイを選択
3. **Redeploy**をクリック

### ステップ3: ビルドログを確認

再デプロイ後、ビルドログを確認して、以下が表示されているか確認：

```
Route (app)                              Size     First Load JS
┌ ○ /                                    ... kB   ... kB
```

## 📝 追加の確認事項

もし上記を確認しても問題が解決しない場合は、以下も確認してください：

1. **ブラウザのコンソール**
   - ブラウザの開発者ツールでコンソールエラーがないか確認

2. **ネットワークタブ**
   - リクエストが正しく送信されているか確認
   - 404エラーが発生しているURLを確認

3. **VercelのFunctionsログ**
   - Functionsタブでエラーが発生していないか確認

4. **Next.jsのバージョン**
   - `package.json`で`next`のバージョンが正しいか確認（現在: 16.1.2）

## 🎯 構造確認チェックリスト

- [x] `app`フォルダがルートに存在する
- [x] `app/page.tsx`が存在する（すべて小文字）
- [x] `app/layout.tsx`が存在する
- [x] `app/page.tsx`が`export default function Home()`で正しくエクスポートされている
- [x] `next.config.ts`に`basePath`などの制限設定がない
- [x] プロジェクトがサブディレクトリに入っていない
- [x] `middleware.ts`が存在しない（ルーティングを妨げる可能性がある）

## 💡 次のステップ

構造は完全に正しいため、Vercelの設定やビルドプロセスに問題がある可能性が高いです。

1. まずは上記の確認事項をすべて確認してください
2. 特に**Root Directory**の設定を確認してください
3. ビルドログを詳しく確認してください
4. それでも解決しない場合は、Vercelのサポートに問い合わせてください
