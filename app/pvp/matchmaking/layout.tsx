// マッチングは useSearchParams 使用のためプリレンダーをスキップ
export const dynamic = 'force-dynamic';

export default function MatchmakingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
