import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function iconBase(size: number, rest: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function LayoutDashboardIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function FolderKanbanIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <line x1="9" y1="11" x2="9" y2="17" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <line x1="15" y1="9" x2="15" y2="17" />
    </svg>
  );
}

export function UsersIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function BarChart3Icon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function TrendUpIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

export function TrendDownIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function ClockIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function GitPullRequestIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  );
}

export function FolderIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function MenuIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function XIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size, rest)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
