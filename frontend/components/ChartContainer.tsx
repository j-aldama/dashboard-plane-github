"use client";

import { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/Skeleton";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  loading?: boolean;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  height = 280,
  loading = false,
}: ChartContainerProps) {
  if (loading) {
    return <Skeleton className="h-[280px] w-full rounded-xl" />;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
