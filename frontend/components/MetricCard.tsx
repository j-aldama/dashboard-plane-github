import { ReactNode } from "react";
import { TrendUpIcon, TrendDownIcon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";

type Trend = "up" | "down" | "neutral";

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: Trend;
  trendValue?: string;
  icon?: ReactNode;
  className?: string;
  loading?: boolean;
}

function TrendIndicator({
  trend,
  trendValue,
}: {
  trend: Trend;
  trendValue?: string;
}) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <TrendUpIcon size={14} />
        {trendValue}
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
        <TrendDownIcon size={14} />
        {trendValue}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
      <span className="text-base leading-none">─</span>
      {trendValue}
    </span>
  );
}

export function MetricCard({
  title,
  value,
  trend,
  trendValue,
  icon,
  className = "",
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return <Skeleton variant="card" className={className} />;
  }

  return (
    <div
      className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
      </div>

      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
        {value}
      </p>

      {(trend || trendValue) && (
        <div className="mt-2">
          <TrendIndicator trend={trend ?? "neutral"} trendValue={trendValue} />
        </div>
      )}
    </div>
  );
}
