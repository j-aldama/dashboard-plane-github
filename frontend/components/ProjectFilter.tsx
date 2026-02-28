'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilterContext } from '@/contexts/FilterContext';

interface Project {
  id: string;
  name: string;
  identifier?: string;
}

interface ProjectsResponse {
  projects: Project[];
}

export function ProjectFilter() {
  const { projectIds, setProjects } = useFilterContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<ProjectsResponse>({
    queryKey: ['filter-projects'],
    queryFn: () => apiGet<ProjectsResponse>('/metrics/projects'),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const projects = data?.projects ?? [];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleProject(id: string) {
    if (projectIds.includes(id)) {
      setProjects(projectIds.filter((p) => p !== id));
    } else {
      setProjects([...projectIds, id]);
    }
  }

  function getLabel(): string {
    if (projectIds.length === 0) return 'Proyectos';
    if (projectIds.length === 1) {
      const project = projects.find((p) => p.id === projectIds[0]);
      return project ? project.name : '1 proyecto';
    }
    return `${projectIds.length} proyectos`;
  }

  const hasValue = projectIds.length > 0;

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span>{getLabel()}</span>
        {hasValue && (
          <span className="flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full font-medium">
            {projectIds.length}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Proyectos</p>

            {isLoading && (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mr-2" />
                Cargando proyectos...
              </div>
            )}

            {isError && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No se pudieron cargar los proyectos
              </div>
            )}

            {!isLoading && !isError && projects.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No hay proyectos disponibles
              </div>
            )}

            {!isLoading && projects.length > 0 && (
              <div className="mt-1 max-h-52 overflow-y-auto space-y-0.5">
                {projects.map((project) => {
                  const selected = projectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left
                        ${selected
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                    >
                      <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center
                        ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{project.name}</span>
                      {project.identifier && (
                        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{project.identifier}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {hasValue && (
              <div className="mt-1 pt-1 border-t border-slate-100">
                <button
                  onClick={() => { setProjects([]); setOpen(false); }}
                  className="w-full px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left"
                >
                  Limpiar selección
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
