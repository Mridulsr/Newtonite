/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, Team, WorkItem, WorkItemFilterParams } from './shared/types.ts';
import { api, ApiError } from './services/api.ts';
import { TopNav } from './components/TopNav.tsx';
import { Workbench } from './components/Workbench.tsx';
import { WorkItemDrawer } from './components/WorkItemDrawer.tsx';
import { ConflictModal } from './components/ConflictModal.tsx';
import { CreateItemModal } from './components/CreateItemModal.tsx';
import { ConcurrencyLab } from './components/ConcurrencyLab.tsx';
import { OutboxView } from './components/OutboxView.tsx';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<'workbench' | 'approvals' | 'outbox' | 'concurrency'>('workbench');

  // Work items state
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState<WorkItemFilterParams>({
    teamId: 'all',
    status: 'all',
    severity: 'all',
    page: 1,
    pageSize: 15,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  // Drawer / Modals state
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // OCC Conflict State
  const [conflictError, setConflictError] = useState<ApiError | null>(null);
  const [conflictDraft, setConflictDraft] = useState<Partial<WorkItem> | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  }, []);

  // Fetch initial users and teams
  useEffect(() => {
    const init = async () => {
      try {
        const [uList, tList] = await Promise.all([api.getUsers(), api.getTeams()]);
        setUsers(uList);
        setTeams(tList);
        // Default to Staff Engineer Alex Chen
        const defaultUser = uList.find((u) => u.id === 'user-alex') || uList[0];
        setCurrentUser(defaultUser);
        api.setActorUser(defaultUser.id);
      } catch (err: any) {
        showToast('Failed to initialize users & teams', 'error');
      }
    };
    init();
  }, [showToast]);

  // Load Work Items based on filters and activeTab
  const fetchWorkItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeFilters: WorkItemFilterParams = { ...filters };
      if (activeTab === 'approvals') {
        activeFilters.pendingApproval = true;
      }
      const res = await api.getWorkItems(activeFilters);
      setWorkItems(res.items);
      setTotalCount(res.total);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      showToast(err.message || 'Failed to load work items', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab, showToast]);

  useEffect(() => {
    fetchWorkItems();
  }, [fetchWorkItems]);

  // Switch persona
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    api.setActorUser(user.id);
    showToast(`Switched active persona to ${user.name} (${user.title})`, 'info');
  };

  // Filter updates
  const handleFilterChange = (newFilters: Partial<WorkItemFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Item update handler
  const handleItemUpdated = (updated: WorkItem) => {
    setSelectedItem(updated);
    setWorkItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // Item created handler
  const handleItemCreated = (created: WorkItem) => {
    fetchWorkItems();
    setSelectedItem(created);
  };

  // Trigger OCC conflict
  const handleConflict = (error: ApiError, draft: Partial<WorkItem>) => {
    setConflictError(error);
    setConflictDraft(draft);
  };

  // Resolve conflict: Discard draft and reload server state
  const handleDiscardAndReload = (serverItem: WorkItem) => {
    setSelectedItem(serverItem);
    setConflictError(null);
    setConflictDraft(null);
    showToast(`Loaded latest server version v${serverItem.version}`, 'info');
  };

  // Resolve conflict: Force overwrite using new server version as expectedVersion
  const handleForceOverwrite = async (serverVersion: number, draft: Partial<WorkItem>) => {
    if (!selectedItem) return;
    try {
      const updated = await api.updateWorkItem(selectedItem.id, draft, serverVersion);
      setSelectedItem(updated);
      setConflictError(null);
      setConflictDraft(null);
      fetchWorkItems();
      showToast(`Force overwrite applied. Advanced to v${updated.version}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Force overwrite failed', 'error');
    }
  };

  // Quick claim from table
  const handleClaimItem = async (item: WorkItem) => {
    try {
      const res = await api.claimWorkItem(item.id);
      showToast(`Assigned ${item.id} to ${currentUser?.name}`, 'success');
      fetchWorkItems();
    } catch (err: any) {
      showToast(err.message || 'Claim failed', 'error');
    }
  };

  const pendingApprovalsCount = workItems.filter((i) => i.status === 'PENDING_APPROVAL').length;

  return (
    <div className="min-h-screen bg-neutral-100/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Top Navigation Bar conforming to Top Bar Contract */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        users={users}
        onSelectUser={handleSelectUser}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        outboxPendingCount={0}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-6 py-6">
        {activeTab === 'workbench' && (
          <Workbench
            workItems={workItems}
            teams={teams}
            users={users}
            currentUser={currentUser}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            filters={filters}
            onFilterChange={handleFilterChange}
            onSelectItem={(item) => setSelectedItem(item)}
            onClaimItem={handleClaimItem}
            onRefresh={fetchWorkItems}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>Dual Sign-Off & Approvals Queue</span>
              </div>
              <p className="text-amber-800 dark:text-amber-300">
                These operational items require authorization from designated Approvers or Team Leads before
                they can be executed or resolved. Switch personas in the top-right to test permission checks.
              </p>
            </div>
            <Workbench
              workItems={workItems.filter((i) => i.status === 'PENDING_APPROVAL')}
              teams={teams}
              users={users}
              currentUser={currentUser}
              totalCount={workItems.filter((i) => i.status === 'PENDING_APPROVAL').length}
              currentPage={1}
              totalPages={1}
              filters={filters}
              onFilterChange={handleFilterChange}
              onSelectItem={(item) => setSelectedItem(item)}
              onClaimItem={handleClaimItem}
              onRefresh={fetchWorkItems}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'outbox' && (
          <OutboxView onShowToast={showToast} />
        )}

        {activeTab === 'concurrency' && (
          <ConcurrencyLab
            currentUser={currentUser}
            users={users}
            workItems={workItems}
            onRefreshAll={fetchWorkItems}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Work Item Detail Drawer */}
      {selectedItem && (
        <WorkItemDrawer
          item={selectedItem}
          users={users}
          teams={teams}
          currentUser={currentUser}
          onClose={() => setSelectedItem(null)}
          onItemUpdated={handleItemUpdated}
          onConflict={handleConflict}
          onShowToast={showToast}
        />
      )}

      {/* OCC Conflict Resolution Modal */}
      {conflictError && conflictDraft && (
        <ConflictModal
          error={conflictError}
          localDraft={conflictDraft}
          onDiscardAndReload={handleDiscardAndReload}
          onForceOverwrite={handleForceOverwrite}
          onCancel={() => {
            setConflictError(null);
            setConflictDraft(null);
          }}
        />
      )}

      {/* Create Item Modal */}
      {isCreateModalOpen && (
        <CreateItemModal
          teams={teams}
          users={users}
          currentUser={currentUser}
          onClose={() => setIsCreateModalOpen(false)}
          onItemCreated={handleItemCreated}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-80 flex items-center gap-3 px-4 py-3 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg shadow-2xl text-xs font-medium animate-in slide-in-from-bottom-3 duration-150">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="max-w-md">{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
