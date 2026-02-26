"use client";

import { useDateRange } from "@/contexts/DateRangeContext";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

// ── Preset definitions ────────────────────────────────────────────────────────

interface Preset {
  label: string;
  getRange: () => { from: Date; to: Date };
}

const PRESETS: Preset[] = [
  {
    label: "7 días",
    getRange: () => {
      const to = new Date();
      return { from: addDays(to, -7), to };
    },
  },
  {
    label: "30 días",
    getRange: () => {
      const to = new Date();
      return { from: addDays(to, -30), to };
    },
  },
  {
    label: "Este mes",
    getRange: () => {
      const to = new Date();
      return { from: startOfMonth(to), to };
    },
  },
  {
    label: "Este trimestre",
    getRange: () => {
      const to = new Date();
      return { from: startOfQuarter(to), to };
    },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DateRangePicker() {
  const { dateRange, setDateRange } = useDateRange();

  function applyPreset(preset: Preset) {
    setDateRange(preset.getRange());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="hidden items-center gap-1 sm:flex">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="hidden h-4 w-px bg-slate-200 sm:block" />

      {/* From/To inputs */}
      <div className="flex items-center gap-1.5">
        <label className="hidden text-xs font-medium text-slate-400 md:block">
          Período:
        </label>
        <input
          type="date"
          value={formatDate(dateRange.from)}
          max={formatDate(dateRange.to)}
          onChange={(e) =>
            setDateRange({ ...dateRange, from: new Date(e.target.value) })
          }
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <span className="text-xs text-slate-300">—</span>
        <input
          type="date"
          value={formatDate(dateRange.to)}
          min={formatDate(dateRange.from)}
          onChange={(e) =>
            setDateRange({ ...dateRange, to: new Date(e.target.value) })
          }
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
    </div>
  );
}
