/**
 * Work Item Detail Drawer
 * Comprehensive inspection, state transitions, OCC edits, live viewers, approval execution, and immutable audit trail
 */

import React, { useState, useEffect } from 'react';
import {
  WorkItem,
  User,
  Team,
  AuditEvent,
  WorkItemComment,
  WorkItemStatus,
  WorkItemSeverity,
} from '../shared/types.ts';
import { api, ApiError } from '../services/api.ts';
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Shield,
  Send,
  MessageSquare,
  History,
  FileText,
  Lock,
  ArrowRight,
  Eye,
  RotateCcw,
} from 'lucide-react';

interface WorkItemDrawerProps {
  item: WorkItem | null;
  users: User[];
  teams: Team[];
  currentUser: User | null;
  onClose: () => void;
  onItemUpdated: (updated: WorkItem) => void;
  onConflict: (error: ApiError, currentLocalDraft: Partial<WorkItem>) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WorkItemDrawer: React.FC<WorkItemDrawerProps> = ({
  item,
  users,
  teams,
  currentUser,
  onClose,
  onItemUpdated,
  onConflict,
  onShowToast,
}) => {
  if (!item) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'comments'>('overview');
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [comments, setComments] = useState<WorkItemComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeViewers, setActiveViewers] = useState<Array<{ userId: string; userName: string }>>([]);

  // Edit draft state for OCC updates
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description);
  const [editSeverity, setEditSeverity] = useState<WorkItemSeverity>(item.severity);
  const [isSaving, setIsSaving] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Sync state on item change
  useEffect(() => {
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditSeverity(item.severity);
    loadAuditAndComments();

    // Heartbeat presence tracking
    const heartbeat = () => {
      api.sendHeartbeat(item.id).then((res) => {
        if (res?.viewers) {
          setActiveViewers(res.viewers.filter((v) => v.userId !== currentUser?.id));
        }
      }).catch(() => {});
    };

    heartbeat();
    const interval = setInterval(heartbeat, 8000);
    return () => clearInterval(interval);
  }, [item.id, item.version]);

  const loadAuditAndComments = async () => {
    try {
      const [events, coms] = await Promise.all([
        api.getAuditEvents(item.id),
        api.getComments(item.id),
      ]);
      setAuditEvents(events);
      setComments(coms);
    } catch (err) {
      console.error('Failed to load audit or comments', err);
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const u = users.find((x) => x.id === userId);
    return u?.name || userId;
  };

  const getTeam = (teamId: string) => {
    return teams.find((x) => x.id === teamId);
  };

  // Atomic Claim / Ownership
  const handleClaim = async (forceReassign = false) => {
    setIsClaiming(true);
    try {
      const res = await api.claimWorkItem(item.id, forceReassign);
      onItemUpdated(res.item);
      onShowToast(`Successfully claimed ownership of ${item.id}`, 'success');
      loadAuditAndComments();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onShowToast(`Race Condition: ${err.message}`, 'error');
      } else {
        onShowToast(err.message || 'Failed to claim item', 'error');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // OCC Atomic Update
  const handleSaveOverview = async () => {
    setIsSaving(true);
    const updates: Partial<WorkItem> = {
      title: editTitle,
      description: editDescription,
      severity: editSeverity,
    };

    try {
      // Passes item.version as expectedVersion to enforce Optimistic Concurrency Control
      const updated = await api.updateWorkItem(item.id, updates, item.version);
      onItemUpdated(updated);
      onShowToast(`Saved v${updated.version} successfully`, 'success');
      loadAuditAndComments();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        // Trigger Conflict Resolution Modal
        onConflict(err, updates);
      } else {
        onShowToast(err.message || 'Save failed', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Workflow Status Transition
  const handleTransitionStatus = async (targetStatus: WorkItemStatus) => {
    setIsSaving(true);
    try {
      const updated = await api.updateWorkItem(
        item.id,
        { status: targetStatus },
        item.version
      );
      onItemUpdated(updated);
      onShowToast(`Transitioned to ${targetStatus}`, 'success');
      loadAuditAndComments();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onConflict(err, { status: targetStatus });
      } else {
        onShowToast(err.message || 'Status change failed', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Approval Process
  const handleProcessApproval = async (action: 'APPROVE' | 'REJECT') => {
    setIsApproving(true);
    try {
      const updated = await api.processApproval(item.id, action, approvalNotes);
      onItemUpdated(updated);
      setShowApprovalModal(false);
      setApprovalNotes('');
      onShowToast(
        action === 'APPROVE'
          ? `Work item sign-off APPROVED. Status moved to RESOLVED.`
          : `Sign-off REJECTED. Returned to IN_PROGRESS.`,
        'success'
      );
      loadAuditAndComments();
    } catch (err: any) {
      onShowToast(err.message || 'Approval operation failed', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const added = await api.addComment(item.id, newComment);
      setComments((prev) => [...prev, added]);
      setNewComment('');
      loadAuditAndComments();
      onShowToast('Comment posted', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add comment', 'error');
    }
  };

  const isAssignedToMe = item.assigneeId === currentUser?.id;
  const isPendingApproval = item.status === 'PENDING_APPROVAL';
  const team = getTeam(item.teamId);

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base text-neutral-900 dark:text-white">
              {item.id}
            </span>
            <span className="text-neutral-400">·</span>
            <span className="text-xs font-mono text-neutral-500">v{item.version}</span>
            <span className="text-neutral-400">·</span>
            <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
              {team?.name || item.teamId}
            </span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {item.type.replace('_', ' ')} · Created by {getUserName(item.createdBy)}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Concurrent Active Viewers Notification */}
      {activeViewers.length > 0 && (
        <div className="px-6 py-2 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200/50 dark:border-blue-900/50 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>
            {activeViewers.map((v) => v.userName).join(', ')}{' '}
            {activeViewers.length === 1 ? 'is' : 'are'} currently viewing this work item.
          </span>
        </div>
      )}

      {/* SLA & Status Action Strip */}
      <div className="px-6 py-3.5 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Assignee Lock / Claim */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Owner:</span>
          {item.assigneeId ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 dark:text-white">
                {getUserName(item.assigneeId)}
              </span>
              {isAssignedToMe ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  (You)
                </span>
              ) : (
                <button
                  disabled={isClaiming}
                  onClick={() => handleClaim(true)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  title="Reassign responsibility to yourself"
                >
                  Reassign to Me
                </button>
              )}
            </div>
          ) : (
            <button
              disabled={isClaiming}
              onClick={() => handleClaim(false)}
              className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold rounded hover:bg-neutral-800 transition-colors"
            >
              Take Responsibility
            </button>
          )}
        </div>

        {/* State Machine Action Controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {item.status === 'TRIAGE' && (
            <button
              onClick={() => handleTransitionStatus('IN_PROGRESS')}
              className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Start Progress
            </button>
          )}

          {item.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => handleTransitionStatus('PENDING_APPROVAL')}
                className="px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 transition-colors"
              >
                Request Approval
              </button>
              <button
                onClick={() => handleTransitionStatus('RESOLVED')}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 transition-colors"
              >
                Resolve
              </button>
            </>
          )}

          {item.status === 'PENDING_APPROVAL' && (
            <button
              onClick={() => setShowApprovalModal(true)}
              className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700 transition-colors flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Review Sign-Off</span>
            </button>
          )}

          {item.status === 'BLOCKED' && (
            <button
              onClick={() => handleTransitionStatus('IN_PROGRESS')}
              className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors"
            >
              Resume Progress
            </button>
          )}

          {item.status === 'RESOLVED' && (
            <button
              onClick={() => handleTransitionStatus('CLOSED')}
              className="px-2.5 py-1 bg-neutral-700 text-white rounded font-medium hover:bg-neutral-800 transition-colors"
            >
              Close Ticket
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 relative ${
            activeTab === 'overview'
              ? 'text-neutral-900 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Overview & Context
          {activeTab === 'overview' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 relative flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'text-neutral-900 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <span>Audit History</span>
          <span className="font-mono text-[10px] tabular-nums text-neutral-400">
            ({auditEvents.length})
          </span>
          {activeTab === 'audit' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`py-3 relative flex items-center gap-1.5 ${
            activeTab === 'comments'
              ? 'text-neutral-900 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <span>Collaboration & Notes</span>
          <span className="font-mono text-[10px] tabular-nums text-neutral-400">
            ({comments.length})
          </span>
          {activeTab === 'comments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
          )}
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Approval Banner if pending */}
            {isPendingApproval && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs space-y-2">
                <div className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Dual Sign-Off Required Before Progression</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">
                  This work item requires sign-off by a user with role{' '}
                  <span className="font-mono font-bold">
                    {item.approvalRequirement?.requiredRole || 'APPROVER'}
                  </span>{' '}
                  in team{' '}
                  <span className="font-mono font-bold">
                    {team?.name || item.teamId}
                  </span>
                  .
                </p>
                {item.approvalRequirement?.thresholdAmount && (
                  <div className="font-mono text-amber-900 dark:text-amber-200">
                    Threshold Amount: ${item.approvalRequirement.thresholdAmount.toLocaleString()}
                  </div>
                )}
                <button
                  onClick={() => setShowApprovalModal(true)}
                  className="px-3 py-1.5 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 transition-colors mt-1"
                >
                  Review & Submit Decision
                </button>
              </div>
            )}

            {/* Editable Title */}
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Work Item Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-sm font-semibold p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            {/* Editable Description */}
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Context & Operational Scope
              </label>
              <textarea
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full text-xs p-2.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            {/* Severity & Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Severity Level
                </label>
                <select
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value as WorkItemSeverity)}
                  className="w-full text-xs p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="CRITICAL">Critical (P0)</option>
                  <option value="HIGH">High (P1)</option>
                  <option value="MEDIUM">Medium (P2)</option>
                  <option value="LOW">Low (P3)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  SLA Target Deadline
                </label>
                <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-800/50 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                  {new Date(item.slaDeadline).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Tags (Zero-Pill discipline: unboxed clean text separated by typographic middots) */}
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Operational Tags
              </label>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {item.tags.join(' · ') || 'No tags specified'}
              </div>
            </div>

            {/* Structured Metadata */}
            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Attached Technical Metadata
                </label>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                  {Object.entries(item.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2">
                      <span className="text-neutral-400 font-semibold">{k}:</span>
                      <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button (Optimistic Concurrency Control) */}
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="text-xs text-neutral-400 font-mono">
                OCC Target: v{item.version}
              </div>
              <button
                disabled={isSaving}
                onClick={handleSaveOverview}
                className="px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Validating Version...' : 'Save Modifications'}
              </button>
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="text-xs text-neutral-500 font-medium">
              Immutable event log recording every state transition, assignment change, and modification.
            </div>

            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
              {auditEvents.map((ev) => (
                <div key={ev.id} className="relative pl-8 text-xs space-y-1">
                  <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-neutral-900 dark:bg-white border-2 border-white dark:border-neutral-900" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {ev.actorName}
                    </span>
                    <span className="text-neutral-400">·</span>
                    <span className="font-mono text-[11px] text-neutral-500">
                      {new Date(ev.timestamp).toLocaleTimeString()} ({new Date(ev.timestamp).toLocaleDateString()})
                    </span>
                  </div>
                  <div className="text-neutral-700 dark:text-neutral-300">
                    {ev.summary}
                  </div>

                  {/* Render Diff if available */}
                  {ev.diff && (
                    <div className="mt-1 p-2 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800/80 font-mono text-[11px] space-y-1">
                      {Object.entries(ev.diff).map(([key, change]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="text-neutral-400">{key}:</span>
                          <span className="text-red-600 line-through">
                            {String(change.before)}
                          </span>
                          <span>&rarr;</span>
                          <span className="text-emerald-600 font-semibold">
                            {String(change.after)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <div className="space-y-6">
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs italic">
                  No discussion notes recorded yet.
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {c.userName}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400">
                        {new Date(c.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Box */}
            <form onSubmit={handleAddComment} className="space-y-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <label className="block text-xs font-medium text-neutral-500">
                Add Operational Discussion Note
              </label>
              <textarea
                rows={3}
                placeholder="Document technical findings, customer context, or handoff notes..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full text-xs p-2.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" />
                  <span>Post Note</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Approval Execution Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="font-bold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Operational Authorization Sign-Off</span>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
              <p>
                You are executing a formal decision for{' '}
                <span className="font-mono font-bold text-neutral-900 dark:text-white">
                  {item.id}
                </span>{' '}
                as{' '}
                <span className="font-semibold text-neutral-900 dark:text-white">
                  {currentUser?.name}
                </span>{' '}
                ({currentUser?.title}).
              </p>
              <p className="text-[11px] text-neutral-500">
                The server will strictly enforce that your role matches the required approval
                privilege for {team?.name}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                Authorization Notes / Verification Audit Trail
              </label>
              <textarea
                rows={3}
                placeholder="State reason for approval or rejection (e.g., verified wire beneficiary in Companies House)..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="w-full text-xs p-2.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                disabled={isApproving}
                onClick={() => handleProcessApproval('REJECT')}
                className="px-3.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Reject & Send Back
              </button>
              <button
                disabled={isApproving}
                onClick={() => handleProcessApproval('APPROVE')}
                className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Approve & Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
