interface StatsCardProps {
  title: string;
  value: number | string;
  icon: string;
  color?: string;
}

export default function StatsCard({ title, value, icon, color = 'blue' }: StatsCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white rounded-xl p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg opacity-90">{title}</h3>
        <span className="text-3xl">{icon}</span>
      </div>
      <div className="text-4xl font-bold">{value}</div>
    </div>
  );
}
