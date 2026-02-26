"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { DateRangePicker } from "@/components/DateRangePicker";
import { FreshnessIndicator } from "@/components/FreshnessIndicator";
import {
  LayoutDashboardIcon,
  FolderKanbanIcon,
  UsersIcon,
  BarChart3Icon,
  MenuIcon,
  XIcon,
} from "@/components/icons";

// ── Nav links ──────────────────────────────────────────────────────────────────

const navLinks = [
  {
    href: "/overview",
    label: "Vista General",
    Icon: LayoutDashboardIcon,
    description: "KPIs del equipo",
  },
  {
    href: "/projects",
    label: "Por Proyecto",
    Icon: FolderKanbanIcon,
    description: "Estado de proyectos",
  },
  {
    href: "/person",
    label: "Por Persona",
    Icon: UsersIcon,
    description: "Métricas individuales",
  },
  {
    href: "/comparative",
    label: "Comparativa",
    Icon: BarChart3Icon,
    description: "Comparar miembros",
  },
];

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
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo / branding */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-700/80 px-5">
          <div className="flex items-center gap-2.5">
            {/* Icon mark */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-900/40">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">
                Executive
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Dashboard
              </p>
            </div>
          </div>

          <button
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Vistas
          </p>
          <ul className="space-y-0.5">
            {navLinks.map(({ href, label, description, Icon }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 ${
                      active
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-900/30"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={`flex-shrink-0 ${
                        active
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">
                        {label}
                      </p>
                      <p
                        className={`truncate text-[11px] leading-tight ${
                          active ? "text-blue-200" : "text-slate-500"
                        }`}
                      >
                        {description}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700/80 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
            <p className="text-xs text-slate-500">Plane + GitHub</p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Dashboard shell ────────────────────────────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Page title for header breadcrumb
  const currentNav = navLinks.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            {/* Mobile hamburger */}
            <button
              className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <MenuIcon size={20} />
            </button>

            {/* Page title (visible lg+) */}
            {currentNav && (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium text-slate-400">
                  {currentNav.description}
                </span>
              </div>
            )}

            {/* Date range picker */}
            <DateRangePicker />
          </div>

          {/* Right side */}
          <FreshnessIndicator />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl p-4 sm:p-6">
            {children}
          </div>
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
