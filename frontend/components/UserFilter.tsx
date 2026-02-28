'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useFilterContext } from '@/contexts/FilterContext';

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface ComparativeResponse {
  members: TeamMember[];
}

export function UserFilter() {
  const { userIds, setUsers } = useFilterContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<ComparativeResponse>({
    queryKey: ['filter-users'],
    queryFn: () => apiGet<ComparativeResponse>('/metrics/comparative'),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  const members = data?.members ?? [];

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

  function toggleUser(id: string) {
    if (userIds.includes(id)) {
      setUsers(userIds.filter((u) => u !== id));
    } else {
      setUsers([...userIds, id]);
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function getLabel(): string {
    if (userIds.length === 0) return 'Personas';
    if (userIds.length === 1) {
      const member = members.find((m) => m.id === userIds[0]);
      return member ? member.name.split(' ')[0] : '1 persona';
    }
    return `${userIds.length} personas`;
  }

  const hasValue = userIds.length > 0;

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span>{getLabel()}</span>
        {hasValue && (
          <span className="flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full font-medium">
            {userIds.length}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Miembros del equipo</p>

            {isLoading && (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mr-2" />
                Cargando personas...
              </div>
            )}

            {isError && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No se pudieron cargar los miembros
              </div>
            )}

            {!isLoading && !isError && members.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-400 text-center">
                No hay miembros disponibles
              </div>
            )}

            {!isLoading && members.length > 0 && (
              <div className="mt-1 max-h-52 overflow-y-auto space-y-0.5">
                {members.map((member) => {
                  const selected = userIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleUser(member.id)}
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
                      {/* Avatar */}
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 flex-shrink-0">
                          {getInitials(member.name)}
                        </span>
                      )}
                      <span className="truncate">{member.name}</span>
                      {member.role && (
                        <span className="ml-auto text-xs text-slate-400 flex-shrink-0 truncate max-w-[60px]">{member.role}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {hasValue && (
              <div className="mt-1 pt-1 border-t border-slate-100">
                <button
                  onClick={() => { setUsers([]); setOpen(false); }}
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
