'use client';

import { useState } from 'react';
import { useBlockedTasks, useWorkItemComments, BlockedTask } from '@/hooks/useBlockedTasks';
import { StatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';

function priorityVariant(priority: string | null): 'error' | 'warning' | 'info' | 'neutral' {
  if (!priority) return 'neutral';
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high') return 'error';
  if (p === 'medium') return 'warning';
  if (p === 'low') return 'info';
  return 'neutral';
}

function CommentsPanel({ workItemId }: { workItemId: number }) {
  const { data, isLoading, error } = useWorkItemComments(workItemId);

  if (isLoading) {
    return (
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">No se pudieron cargar los comentarios.</p>
      </div>
    );
  }

  if (data.comments.length === 0) {
    return (
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">Sin comentarios.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 space-y-3">
      <p className="text-xs font-medium text-slate-500">Comentarios</p>
      {data.comments.map((comment, idx) => (
        <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-700">{comment.actor_name}</span>
            {comment.created_at && (
              <span className="text-xs text-slate-400">
                {new Date(comment.created_at).toLocaleDateString('es-CL')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{comment.body}</p>
        </div>
      ))}
    </div>
  );
}

function BlockedTaskRow({ task }: { task: BlockedTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-6 py-3 hover:bg-slate-50 transition-colors flex items-center gap-4"
      >
        {/* Expand indicator */}
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {task.project_identifier ?? task.project_name}
            </span>
            {task.assignee_name && (
              <span className="text-xs text-slate-500">{task.assignee_name}</span>
            )}
          </div>
        </div>

        {/* Priority + State */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.priority && (
            <StatusBadge
              label={task.priority}
              variant={priorityVariant(task.priority)}
            />
          )}
          {task.state && (
            <StatusBadge label={task.state} variant="in-progress" />
          )}
        </div>
      </button>

      {expanded && <CommentsPanel workItemId={task.id} />}
    </div>
  );
}

export function BlockedTasks() {
  const { data, isLoading, error, refetch } = useBlockedTasks();

  if (isLoading) {
    return (
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Tareas Bloqueadas
        </h3>
        <TableSkeleton rows={3} cols={4} />
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-4">
          Tareas Bloqueadas
        </h3>
        <div className="card p-6 text-center">
          <p className="text-slate-500 text-sm">No se pudieron cargar las tareas bloqueadas.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  const tasks = data?.tasks ?? [];

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-base font-semibold text-slate-800">
          Tareas Bloqueadas
        </h3>
        {tasks.length > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
            {tasks.length}
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">No hay tareas bloqueadas.</p>
          </div>
        ) : (
          <div>
            {tasks.map((task) => (
              <BlockedTaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
