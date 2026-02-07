# Discordログインが戻ってしまう問題のトラブルシューティング

## ⚠️ 重要：URLの一致

**ログインを試すときは、必ず `https://hstfanclub.vercel.app` でアクセスしてください。**

プレビューデプロイのURL（例: `hstfanclub-2twg5q10n-...vercel.app`）でログインすると失敗します。理由：
- ログインボタン押下時に、そのURL用のクッキーがセットされる
- Supabaseは許可リストのURL（`hstfanclub.vercel.app`）にリダイレクトする
- ドメインが違うため、先ほどセットしたクッキーが送信されず、認証に失敗する

---

# Discordログインが戻ってしまう問題のトラブルシューティング

Discordでログイン後に元のログイン画面に戻ってしまう場合、以下の設定を確認してください。

## 1. Supabaseダッシュボードの設定

### URL Configuration

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. 以下を確認・設定：

**Site URL**（必須）:
- 本番: `https://あなたのサイト.vercel.app`
- 開発: `http://localhost:3000`

**Redirect URLs**（必須）:
以下のURLを**すべて**追加してください：
```
https://あなたのサイト.vercel.app/auth/callback
https://あなたのサイト.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

ワイルドカード `/**` も追加しておくと、すべてのパスでリダイレクトを受け付けます。

## 2. Discord Developer Portalの設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. アプリを選択 → **OAuth2** → **Redirects**
3. **SupabaseのコールバックURL**を追加：
   ```
   https://あなたのプロジェクトID.supabase.co/auth/v1/callback
   ```
   - このURLは Supabase Dashboard → Authentication → Providers → Discord の「Callback URL」で確認できます

## 3. 認証フローの確認

1. ログインボタンをクリック
2. Discordの認証画面が表示される
3. 認証後、`/auth/callback?code=xxx` にリダイレクトされる
4. セッションが設定され、トップページにリダイレクトされる

**エラーが発生した場合**:
- トップページに `?error=エラーメッセージ` 付きでリダイレクトされます
- エラーメッセージを確認して、上記の設定を見直してください

## 4. よくあるエラーと対処法

| エラー | 原因 | 対処法 |
|-------|------|--------|
| `redirect_url is not allowed` | Redirect URLがSupabaseの許可リストにない | URL Configuration の Redirect URLs に追加 |
| `both auth code and code verifier should be non-empty` | PKCEの証明書クッキーが失われた | 同一ドメインでログインしているか確認。Cookieがブロックされていないか確認 |
| `Invalid OAuth state` | セッションの不整合 | ブラウザのCookieをクリアして再試行 |

## 5. 本番環境（Vercel）の場合

- **Site URL** を `https://あなたのVercelドメイン` に設定
- **Redirect URLs** に `https://あなたのVercelドメイン/auth/callback` を追加
- 環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しく設定されているか確認

## 6. 修正されたコード

以下の修正が適用されています：
- 認証コールバックでエラーを検出し、エラーメッセージを表示
- Vercel環境でのリダイレクト処理を改善（x-forwarded-host対応）
- エラー時のユーザーへのフィードバックを追加
