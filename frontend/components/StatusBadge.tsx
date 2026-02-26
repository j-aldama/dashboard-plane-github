type StatusColor = "green" | "yellow" | "red" | "blue";
type BadgeSize = "sm" | "md" | "lg";

interface StatusBadgeProps {
  status: StatusColor;
  label?: string;
  size?: BadgeSize;
}

const labelMap: Record<StatusColor, string> = {
  green: "En tiempo",
  yellow: "Riesgo",
  red: "Atrasado",
  blue: "Soporte",
};

const colorMap: Record<
  StatusColor,
  { dot: string; text: string; bg: string; border: string }
> = {
  green: {
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  yellow: {
    dot: "bg-yellow-400",
    text: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  red: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  blue: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
};

const sizeMap: Record<BadgeSize, { dot: string; text: string; padding: string }> = {
  sm: { dot: "h-1.5 w-1.5", text: "text-xs", padding: "px-2 py-0.5" },
  md: { dot: "h-2 w-2", text: "text-sm", padding: "px-2.5 py-1" },
  lg: { dot: "h-2.5 w-2.5", text: "text-sm", padding: "px-3 py-1.5" },
};

export function StatusBadge({
  status,
  label,
  size = "md",
}: StatusBadgeProps) {
  const colors = colorMap[status];
  const sizing = sizeMap[size];
  const displayLabel = label ?? labelMap[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${colors.bg} ${colors.border} ${colors.text} ${sizing.padding}`}
    >
      <span className={`rounded-full ${colors.dot} ${sizing.dot} flex-shrink-0`} />
      <span className={sizing.text}>{displayLabel}</span>
    </span>
  );
}
