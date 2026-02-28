'use client';

import { useEffect, useRef, useState } from 'react';
import { useFilterContext } from '@/contexts/FilterContext';

interface DatePreset {
  label: string;
  getValue: () => { from: string; to: string };
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const DATE_PRESETS: DatePreset[] = [
  {
    label: 'Última semana',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { from: toISODate(from), to: toISODate(to) };
    },
  },
  {
    label: 'Último mes',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      return { from: toISODate(from), to: toISODate(to) };
    },
  },
  {
    label: 'Último trimestre',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 3);
      return { from: toISODate(from), to: toISODate(to) };
    },
  },
  {
    label: 'Todo',
    getValue: () => ({ from: '', to: '' }),
  },
];

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function DateRangePicker() {
  const { dateFrom, dateTo, setDateRange } = useFilterContext();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom ?? '');
  const [customTo, setCustomTo] = useState(dateTo ?? '');
  const ref = useRef<HTMLDivElement>(null);

  // Sync local state when context changes (e.g. clearFilters)
  useEffect(() => {
    setCustomFrom(dateFrom ?? '');
    setCustomTo(dateTo ?? '');
  }, [dateFrom, dateTo]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function getActivePresetLabel(): string {
    for (const preset of DATE_PRESETS) {
      if (preset.label === 'Todo') {
        if (!dateFrom && !dateTo) return 'Todo';
        continue;
      }
      const { from, to } = preset.getValue();
      // Allow 1-day tolerance for "today" comparisons
      if (dateFrom === from && dateTo === to) return preset.label;
    }
    if (dateFrom || dateTo) {
      const parts: string[] = [];
      if (dateFrom) parts.push(formatDisplayDate(dateFrom));
      parts.push('→');
      if (dateTo) parts.push(formatDisplayDate(dateTo));
      return parts.join(' ');
    }
    return 'Rango de fechas';
  }

  function handlePreset(preset: DatePreset) {
    const { from, to } = preset.getValue();
    setCustomFrom(from);
    setCustomTo(to);
    setDateRange(from || null, to || null);
    if (preset.label !== 'Personalizado') {
      setOpen(false);
    }
  }

  function handleApplyCustom() {
    setDateRange(customFrom || null, customTo || null);
    setOpen(false);
  }

  function isPresetActive(preset: DatePreset): boolean {
    if (preset.label === 'Todo') return !dateFrom && !dateTo;
    const { from, to } = preset.getValue();
    return dateFrom === from && dateTo === to;
  }

  const hasValue = Boolean(dateFrom || dateTo);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap
          ${hasValue
            ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
            : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800'
          }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{getActivePresetLabel()}</span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          {/* Presets */}
          <div className="p-2 border-b border-slate-100">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Presets</p>
            <div className="mt-1 space-y-0.5">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                    ${isPresetActive(preset)
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  {isPresetActive(preset) && (
                    <span className="mr-2 text-blue-600">✓</span>
                  )}
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rango personalizado</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || undefined}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom || undefined}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleApplyCustom}
                disabled={!customFrom && !customTo}
                className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
