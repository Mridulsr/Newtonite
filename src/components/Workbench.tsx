/**
 * Command Workbench - High-density operational data grid and Kanban board
 */

import React, { useState } from 'react';
import {
  WorkItem,
  Team,
  User,
  WorkItemStatus,
  WorkItemSeverity,
  WorkItemFilterParams,
} from '../shared/types.ts';
import {
  Search,
  Filter,
  AlertTriangle,
  Clock,
  UserCheck,
  RotateCcw,
  LayoutGrid,
  List,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Users,
} from 'lucide-react';

interface WorkbenchProps {
  workItems: WorkItem[];
  teams: Team[];
  users: User[];
  currentUser: User | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  filters: WorkItemFilterParams;
  onFilterChange: (newFilters: Partial<WorkItemFilterParams>) => void;
  onSelectItem: (item: WorkItem) => void;
  onClaimItem: (item: WorkItem) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  workItems,
  teams,
  users,
  currentUser,
  totalCount,
  currentPage,
  totalPages,
  filters,
  onFilterChange,
  onSelectItem,
  onClaimItem,
  onRefresh,
  isLoading,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Compute metrics from current items / query
  const criticalCount = workItems.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
  const pendingApprovalsCount = workItems.filter((i) => i.status === 'PENDING_APPROVAL').length;
  const breachedCount = workItems.filter((i) => i.slaBreached && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
  const unassignedCount = workItems.filter((i) => !i.assigneeId && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const u = users.find((x) => x.id === userId);
    return u?.name || userId;
  };

  const getTeamName = (teamId: string) => {
    const t = teams.find((x) => x.id === teamId);
    return t?.name || teamId;
  };

  const formatSlaRemaining = (deadlineStr: string, breached: boolean, status: WorkItemStatus) => {
    if (status === 'RESOLVED' || status === 'CLOSED') {
      return <span className="text-neutral-500 font-mono text-xs">Completed</span>;
    }
    const diffMs = new Date(deadlineStr).getTime() - Date.now();
    if (breached || diffMs <= 0) {
      return (
        <span className="text-red-600 dark:text-red-400 font-mono font-medium text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>BREACHED</span>
        </span>
      );
    }
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    const timeLabel = hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
    const isUrgent = mins < 60;

    return (
      <span className={`font-mono text-xs ${isUrgent ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-neutral-600 dark:text-neutral-400'}`}>
        {timeLabel}
      </span>
    );
  };

  const getSeverityLabel = (severity: WorkItemSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="font-semibold text-red-600 dark:text-red-400">CRITICAL</span>;
      case 'HIGH':
        return <span className="font-semibold text-amber-600 dark:text-amber-400">HIGH</span>;
      case 'MEDIUM':
        return <span className="font-medium text-blue-600 dark:text-blue-400">MEDIUM</span>;
      case 'LOW':
        return <span className="text-neutral-500">LOW</span>;
    }
  };

  const getStatusLabel = (status: WorkItemStatus) => {
    switch (status) {
      case 'TRIAGE':
        return <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300">TRIAGE</span>;
      case 'IN_PROGRESS':
        return <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">IN PROGRESS</span>;
      case 'PENDING_APPROVAL':
        return <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">PENDING APPROVAL</span>;
      case 'BLOCKED':
        return <span className="font-mono text-xs text-red-600 dark:text-red-400 font-medium">BLOCKED</span>;
      case 'RESOLVED':
        return <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">RESOLVED</span>;
      case 'CLOSED':
        return <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">CLOSED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Metric Strip (Tabular Figures) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Total Active</div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1 tabular-nums">
            {totalCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Critical (P0)</div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1 tabular-nums">
            {criticalCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Pending Approval</div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {pendingApprovalsCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200/80 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">SLA Breached</div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1 tabular-nums">
            {breachedCount}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-200/80 dark:border-neutral-800 col-span-2 sm:col-span-1">
          <div className="text-xs text-neutral-500 font-medium">Unassigned Work</div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
            {unassignedCount}
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, and View Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ticket ID, title, tags, or description..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Team Filter */}
          <select
            value={filters.teamId || 'all'}
            onChange={(e) => onFilterChange({ teamId: e.target.value, page: 1 })}
            className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 focus:outline-none text-xs"
          >
            <option value="all">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || 'all'}
            onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}
            className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 focus:outline-none text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="TRIAGE">Triage</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="BLOCKED">Blocked</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Severity Filter */}
          <select
            value={filters.severity || 'all'}
            onChange={(e) => onFilterChange({ severity: e.target.value, page: 1 })}
            className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md text-neutral-800 dark:text-neutral-200 focus:outline-none text-xs"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Quick Toggle: Unassigned Only */}
          <button
            onClick={() => onFilterChange({ unassigned: !filters.unassigned, page: 1 })}
            className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              filters.unassigned
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent'
                : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}
          >
            Unassigned Only
          </button>

          {/* Quick Toggle: SLA Breached */}
          <button
            onClick={() => onFilterChange({ slaBreached: !filters.slaBreached, page: 1 })}
            className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              filters.slaBreached
                ? 'bg-red-600 text-white border-transparent'
                : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}
          >
            SLA Breached
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            title="Refresh items"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-neutral-300 dark:border-neutral-700 rounded-md overflow-hidden ml-auto lg:ml-2">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
              title="Kanban View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {viewMode === 'table' ? (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-4 w-24">ID</th>
                  <th className="py-2.5 px-4">Title & Context</th>
                  <th className="py-2.5 px-3 w-32">Team</th>
                  <th className="py-2.5 px-3 w-24">Severity</th>
                  <th className="py-2.5 px-3 w-32">Status</th>
                  <th className="py-2.5 px-3 w-36">Assignee</th>
                  <th className="py-2.5 px-3 w-28">SLA Remaining</th>
                  <th className="py-2.5 px-3 w-16 text-center">Version</th>
                  <th className="py-2.5 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {workItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-neutral-500">
                      No operational work items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  workItems.map((item) => {
                    const assigneeName = getUserName(item.assigneeId);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => onSelectItem(item)}
                        className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors group"
                      >
                        {/* ID */}
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white tabular-nums">
                          {item.id}
                        </td>

                        {/* Title & Metadata (Zero-Pill discipline: unboxed clean text separated by dots) */}
                        <td className="py-3 px-4 max-w-md">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5 truncate">
                            <span>{item.type.replace('_', ' ')}</span>
                            <span>·</span>
                            <span>Created by {getUserName(item.createdBy)}</span>
                            {item.approvalRequirement?.status === 'PENDING' && (
                              <>
                                <span>·</span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Requires Approval</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Team */}
                        <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300">
                          {getTeamName(item.teamId)}
                        </td>

                        {/* Severity */}
                        <td className="py-3 px-3">{getSeverityLabel(item.severity)}</td>

                        {/* Status */}
                        <td className="py-3 px-3">{getStatusLabel(item.status)}</td>

                        {/* Assignee */}
                        <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300">
                          {assigneeName ? (
                            <div className="truncate">{assigneeName}</div>
                          ) : (
                            <span className="text-neutral-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* SLA */}
                        <td className="py-3 px-3">
                          {formatSlaRemaining(item.slaDeadline, item.slaBreached, item.status)}
                        </td>

                        {/* Version (OCC) */}
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-neutral-400 tabular-nums">
                          v{item.version}
                        </td>

                        {/* Action */}
                        <td
                          className="py-3 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!item.assigneeId && item.status !== 'RESOLVED' && item.status !== 'CLOSED' ? (
                            <button
                              onClick={() => onClaimItem(item)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded hover:bg-neutral-800 transition-colors whitespace-nowrap"
                            >
                              Claim
                            </button>
                          ) : (
                            <button
                              onClick={() => onSelectItem(item)}
                              className="px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                            >
                              View &rarr;
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="py-3 px-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <div>
              Showing <span className="font-mono tabular-nums">{workItems.length}</span> of{' '}
              <span className="font-mono tabular-nums">{totalCount}</span> items
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => onFilterChange({ page: currentPage - 1 })}
                className="p-1 rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono tabular-nums px-2">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => onFilterChange({ page: currentPage + 1 })}
                className="p-1 rounded border border-neutral-300 dark:border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {(['TRIAGE', 'IN_PROGRESS', 'PENDING_APPROVAL', 'BLOCKED', 'RESOLVED'] as WorkItemStatus[]).map((statusCol) => {
            const columnItems = workItems.filter((i) => i.status === statusCol);
            return (
              <div
                key={statusCol}
                className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 flex flex-col min-h-[500px]"
              >
                <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>{statusCol.replace('_', ' ')}</span>
                  <span className="font-mono tabular-nums text-neutral-400">
                    {columnItems.length}
                  </span>
                </div>
                <div className="space-y-2.5 pt-3 flex-1 overflow-y-auto">
                  {columnItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className="bg-white dark:bg-neutral-800/80 p-3 rounded border border-neutral-200 dark:border-neutral-700/80 shadow-xs hover:border-neutral-400 transition-colors cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {item.id}
                        </span>
                        {getSeverityLabel(item.severity)}
                      </div>
                      <div className="text-xs font-medium text-neutral-900 dark:text-white line-clamp-2">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-700/50">
                        <span className="truncate">
                          {item.assigneeId ? getUserName(item.assigneeId) : 'Unassigned'}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400">
                          v{item.version}
                        </span>
                      </div>
                    </div>
                  ))}
                  {columnItems.length === 0 && (
                    <div className="text-center py-8 text-neutral-400 text-xs italic">
                      No items in {statusCol.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
