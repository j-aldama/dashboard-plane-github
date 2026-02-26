import { HTMLAttributes } from "react";

type SkeletonVariant = "text" | "card" | "chart" | "table";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  lines?: number;
}

const shimmer =
  "animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]";

export function Skeleton({
  variant = "text",
  lines = 3,
  className = "",
  ...rest
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className={`space-y-2 ${className}`} {...rest}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${shimmer} h-4 rounded ${i === lines - 1 ? "w-3/4" : "w-full"}`}
          />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
        {...rest}
      >
        <div className={`${shimmer} mb-4 h-4 w-1/3 rounded`} />
        <div className={`${shimmer} mb-2 h-8 w-1/2 rounded`} />
        <div className={`${shimmer} h-3 w-1/4 rounded`} />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
        {...rest}
      >
        <div className={`${shimmer} mb-4 h-4 w-1/4 rounded`} />
        <div className={`${shimmer} h-48 w-full rounded-lg`} />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
        {...rest}
      >
        <div className="border-b border-slate-100 p-4">
          <div className={`${shimmer} h-4 w-1/4 rounded`} />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-50 p-4 last:border-0"
          >
            <div className={`${shimmer} h-8 w-8 rounded-full`} />
            <div className="flex-1 space-y-1.5">
              <div className={`${shimmer} h-3.5 w-1/3 rounded`} />
              <div className={`${shimmer} h-3 w-1/4 rounded`} />
            </div>
            <div className={`${shimmer} h-3.5 w-16 rounded`} />
            <div className={`${shimmer} h-3.5 w-16 rounded`} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
