"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DateRangeProvider, useDateRange } from "@/contexts/DateRangeContext";
import { useHealth } from "@/hooks/useHealth";
import {
  LayoutDashboardIcon,
  FolderKanbanIcon,
  UsersIcon,
  BarChart3Icon,
  RefreshIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons";

// ── Nav links ──────────────────────────────────────────────────────────────────

const navLinks = [
  {
    href: "/overview",
    label: "Vista General",
    Icon: LayoutDashboardIcon,
  },
  {
    href: "/projects",
    label: "Por Proyecto",
    Icon: FolderKanbanIcon,
  },
  {
    href: "/person",
    label: "Por Persona",
    Icon: UsersIcon,
  },
  {
    href: "/comparative",
    label: "Comparativa",
    Icon: BarChart3Icon,
  },
];

// ── Freshness indicator ────────────────────────────────────────────────────────

function FreshnessIndicator() {
  const { data, dataUpdatedAt, refetch, isFetching } = useHealth();

  const formatElapsed = useCallback(() => {
    if (!dataUpdatedAt) return "—";
    const diffMs = Date.now() - dataUpdatedAt;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "hace menos de 1 min";
    if (diffMin === 1) return "hace 1 min";
    return `hace ${diffMin} min`;
  }, [dataUpdatedAt]);

  const statusOk = data?.status === "ok";

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
        <span
          className={`h-2 w-2 rounded-full ${statusOk ? "bg-green-400" : "bg-slate-300"}`}
        />
        <span>Última actualización: {formatElapsed()}</span>
      </div>
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        title="Actualizar datos"
      >
        <RefreshIcon
          size={13}
          className={isFetching ? "animate-spin" : ""}
        />
        <span className="hidden sm:inline">Actualizar</span>
      </button>
    </div>
  );
}

// ── Date range picker ──────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function DateRangePicker() {
  const { dateRange, setDateRange } = useDateRange();

  return (
    <div className="flex items-center gap-2">
      <label className="hidden text-xs font-medium text-slate-500 sm:block">
        Período:
      </label>
      <input
        type="date"
        value={formatDate(dateRange.from)}
        max={formatDate(dateRange.to)}
        onChange={(e) =>
          setDateRange({ ...dateRange, from: new Date(e.target.value) })
        }
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <span className="text-xs text-slate-400">→</span>
      <input
        type="date"
        value={formatDate(dateRange.to)}
        min={formatDate(dateRange.from)}
        onChange={(e) =>
          setDateRange({ ...dateRange, to: new Date(e.target.value) })
        }
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-slate-900 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-700">
          <div>
            <span className="text-base font-bold text-white leading-tight">
              Executive
            </span>
            <br />
            <span className="text-xs font-medium text-slate-400 tracking-widest uppercase">
              Dashboard
            </span>
          </div>
          <button
            className="text-slate-400 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {navLinks.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-3">
          <p className="text-xs text-slate-500">
            Plane + GitHub Integration
          </p>
        </div>
      </aside>
    </>
  );
}

// ── Dashboard shell ────────────────────────────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="text-slate-400 hover:text-slate-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <MenuIcon size={20} />
            </button>
            <DateRangePicker />
          </div>
          <FreshnessIndicator />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Layout export ──────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DateRangeProvider>
      <DashboardShell>{children}</DashboardShell>
    </DateRangeProvider>
  );
}
