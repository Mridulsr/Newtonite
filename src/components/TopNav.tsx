/**
 * Top Navigation Bar conforming to the Top Bar Contract:
 * [Brand Wordmark] — [4 single-line nav links] — [Persona Switcher & Primary Action]
 */

import React, { useState } from 'react';
import { User } from '../shared/types.ts';
import { Plus, UserCheck, ChevronDown, Check, Shield } from 'lucide-react';

interface TopNavProps {
  activeTab: 'workbench' | 'approvals' | 'outbox' | 'concurrency';
  setActiveTab: (tab: 'workbench' | 'approvals' | 'outbox' | 'concurrency') => void;
  currentUser: User | null;
  users: User[];
  onSelectUser: (user: User) => void;
  onOpenCreateModal: () => void;
  pendingApprovalsCount: number;
  outboxPendingCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  users,
  onSelectUser,
  onOpenCreateModal,
  pendingApprovalsCount,
  outboxPendingCount,
}) => {
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-40">
      <div className="max-w-[1520px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-900 font-black text-sm">
            N
          </div>
          <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap">
            Newtonite Operations
          </span>
        </div>

        {/* Zone 2: Single-line navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`whitespace-nowrap transition-colors py-1 relative ${
              activeTab === 'workbench'
                ? 'text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Command Workbench
            {activeTab === 'workbench' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`whitespace-nowrap transition-colors py-1 flex items-center gap-2 relative ${
              activeTab === 'approvals'
                ? 'text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span>Approval Queue</span>
            {pendingApprovalsCount > 0 && (
              <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                ({pendingApprovalsCount})
              </span>
            )}
            {activeTab === 'approvals' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('outbox')}
            className={`whitespace-nowrap transition-colors py-1 flex items-center gap-2 relative ${
              activeTab === 'outbox'
                ? 'text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <span>Outbox & Workers</span>
            {outboxPendingCount > 0 && (
              <span className="text-xs font-mono text-neutral-500 tabular-nums">
                ({outboxPendingCount})
              </span>
            )}
            {activeTab === 'outbox' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('concurrency')}
            className={`whitespace-nowrap transition-colors py-1 relative ${
              activeTab === 'concurrency'
                ? 'text-neutral-900 dark:text-white font-semibold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Concurrency & Stress Lab
            {activeTab === 'concurrency' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
        </nav>

        {/* Zone 3: Active Persona Switcher & Primary Action */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Persona Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPersonaOpen(!isPersonaOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap"
              title="Switch user to evaluate authorization roles"
            >
              <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-bold text-[10px]">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-semibold block">{currentUser?.name || 'Select User'}</span>
                <span className="text-[10px] text-neutral-500 block">
                  {currentUser?.globalRole} · {currentUser?.department}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>

            {isPersonaOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsPersonaOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl z-50 py-2">
                  <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Select Active Persona (Role Simulation)
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
                    {users.map((u) => {
                      const isSelected = u.id === currentUser?.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            onSelectUser(u);
                            setIsPersonaOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/70 transition-colors flex items-start justify-between gap-2 ${
                            isSelected ? 'bg-neutral-50 dark:bg-neutral-800/50' : ''
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                              {u.name}
                              {u.globalRole === 'ADMIN' && (
                                <Shield className="w-3 h-3 text-red-500 inline" />
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                              {u.title}
                            </div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">
                              {u.globalRole} · {u.teamMemberships.map((m) => `${m.teamId.replace('team-', '')}:${m.role}`).join(', ')}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-neutral-900 dark:text-white shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded-md hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Work Item</span>
          </button>
        </div>
      </div>
    </header>
  );
};
