"use client";

import { SVGProps } from "react";
import { CheckCircleIcon, ClockIcon, XIcon } from "@/components/icons";

// ── Types ──────────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "in_progress" | "completed" | "error";

export interface SyncStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
}

export interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: SyncStep[];
  overallProgress: number; // 0-100
  isSyncing: boolean;
}

// ── Internal icons ─────────────────────────────────────────────────────────────

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function SpinnerIcon({ size = 20, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
      {...rest}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function XCircleIcon({ size = 20, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ── Step icon ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircleIcon size={14} />
        </span>
      );
    case "in_progress":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <SpinnerIcon size={14} />
        </span>
      );
    case "error":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">
          <XCircleIcon size={14} />
        </span>
      );
    case "pending":
    default:
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <ClockIcon size={14} />
        </span>
      );
  }
}

// ── Step row ───────────────────────────────────────────────────────────────────

function StepRow({ step }: { step: SyncStep }) {
  const labelColor: Record<StepStatus, string> = {
    pending: "text-slate-400",
    in_progress: "text-slate-700 font-medium",
    completed: "text-slate-700",
    error: "text-red-600 font-medium",
  };

  return (
    <li className="flex items-start gap-3">
      <StepIcon status={step.status} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-6 ${labelColor[step.status]}`}>
          {step.label}
        </p>
        {step.message && (
          <p
            className={`mt-0.5 text-xs ${
              step.status === "error" ? "text-red-500" : "text-slate-400"
            }`}
          >
            {step.message}
          </p>
        )}
      </div>
    </li>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveTitle(isSyncing: boolean, steps: SyncStep[]): string {
  if (isSyncing) return "Sincronizando datos...";
  const hasError = steps.some((s) => s.status === "error");
  return hasError ? "Sincronización con errores" : "Sincronización completada";
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ── SyncProgressModal ──────────────────────────────────────────────────────────

export function SyncProgressModal({
  isOpen,
  onClose,
  steps,
  overallProgress,
  isSyncing,
}: SyncProgressModalProps) {
  if (!isOpen) return null;

  const progress = clampProgress(overallProgress);
  const title = deriveTitle(isSyncing, steps);

  function handleBackdropClick() {
    if (!isSyncing) onClose();
  }

  function handleModalClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Modal panel */}
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={handleModalClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          {!isSyncing && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar modal"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Progress bar */}
          <div className="mb-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Progreso general
              </span>
              <span className="text-xs font-semibold text-indigo-600">
                {progress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          {/* Steps list */}
          <ul className="space-y-3">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ul>
        </div>

        {/* Footer — only when sync finished */}
        {!isSyncing && (
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
