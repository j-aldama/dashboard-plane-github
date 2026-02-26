"use client";

import { useState, ReactNode } from "react";
import { ChevronUpIcon, ChevronDownIcon } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Row) => ReactNode;
}

export type Row = Record<string, unknown>;

interface RankingTableProps {
  columns: Column[];
  data: Row[];
  defaultSort?: string;
  onRowClick?: (row: Row) => void;
  loading?: boolean;
}

type SortDir = "asc" | "desc";

function sortData(data: Row[], key: string, dir: SortDir): Row[] {
  return [...data].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    const cmp = av! > bv! ? 1 : -1;
    return dir === "asc" ? cmp : -cmp;
  });
}

export function RankingTable({
  columns,
  data,
  defaultSort,
  onRowClick,
  loading = false,
}: RankingTableProps) {
  const [sortKey, setSortKey] = useState<string>(defaultSort ?? "");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (loading) {
    return <Skeleton variant="table" lines={5} />;
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = sortKey ? sortData(data, sortKey, sortDir) : data;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                  col.sortable ? "cursor-pointer select-none hover:text-slate-700" : ""
                }`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === "asc" ? (
                      <ChevronUpIcon size={12} className="text-brand-600" />
                    ) : (
                      <ChevronDownIcon size={12} className="text-brand-600" />
                    )
                  )}
                  {col.sortable && sortKey !== col.key && (
                    <span className="opacity-30">
                      <ChevronDownIcon size={12} />
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map((row, idx) => (
            <tr
              key={idx}
              className={`transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-slate-50"
                  : "hover:bg-slate-50/50"
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-700">
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-400"
              >
                No hay datos disponibles
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
