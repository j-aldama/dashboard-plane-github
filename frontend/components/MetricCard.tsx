interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  change,
  changeType = 'neutral',
  subtitle,
}: MetricCardProps) {
  const changeColorClass =
    changeType === 'positive'
      ? 'text-emerald-600'
      : changeType === 'negative'
      ? 'text-red-500'
      : 'text-slate-500';

  const changePrefix = change !== undefined && change > 0 ? '+' : '';

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          <p className="metric-value mt-2">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
          {change !== undefined && (
            <p className={`mt-2 text-sm font-medium ${changeColorClass}`}>
              {changePrefix}{change}% vs período anterior
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-slate-100 rounded-lg text-slate-600 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
