/**
 * Create Work Item Modal with Idempotency Token Protection
 */

import React, { useState } from 'react';
import { Team, User, WorkItemType, WorkItemSeverity, WorkItem } from '../shared/types.ts';
import { api, generateIdempotencyKey } from '../services/api.ts';
import { X, Plus, Shield, Clock } from 'lucide-react';

interface CreateItemModalProps {
  teams: Team[];
  users: User[];
  currentUser: User | null;
  onClose: () => void;
  onItemCreated: (item: WorkItem) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  teams,
  users,
  currentUser,
  onClose,
  onItemCreated,
  onShowToast,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState(teams[0]?.id || 'team-incident');
  const [type, setType] = useState<WorkItemType>('INCIDENT');
  const [severity, setSeverity] = useState<WorkItemSeverity>('HIGH');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [approvalThreshold, setApprovalThreshold] = useState<number | undefined>(undefined);
  const [customSlaMinutes, setCustomSlaMinutes] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stable idempotency key for this modal instance
  const [idempotencyKey] = useState(() => generateIdempotencyKey('new-item'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      onShowToast('Please provide both title and description', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        teamId,
        type,
        severity,
        assigneeId: assigneeId || null,
        tags,
        approvalRequired,
        approvalThreshold: approvalThreshold ? Number(approvalThreshold) : undefined,
        customSlaMinutes: customSlaMinutes ? Number(customSlaMinutes) : undefined,
      };

      const item = await api.createWorkItem(payload, idempotencyKey);
      onItemCreated(item);
      onShowToast(`Created work item ${item.id}`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create work item', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-60">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
              Log New Operational Work Item
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Strictly validated against target team authorization policy.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Title / Summary *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Kafka partition lag spike on primary billing consumer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Context, Symptoms & Scope *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Explain why this item exists, customer/system impact, and relevant telemetry..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Team & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Target Team *
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Work Item Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkItemType)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                <option value="INCIDENT">Production Incident</option>
                <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
                <option value="CUSTOMER_ESCALATION">Customer Escalation</option>
                <option value="ENGINEERING_BUG">Engineering Bug</option>
                <option value="COMPLIANCE_REQUEST">Compliance & Audit</option>
                <option value="OPERATIONAL_TASK">Operational Task</option>
              </select>
            </div>
          </div>

          {/* Severity & Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Severity Level *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as WorkItemSeverity)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                <option value="CRITICAL">Critical (P0 - 1hr SLA)</option>
                <option value="HIGH">High (P1 - 4hr SLA)</option>
                <option value="MEDIUM">Medium (P2 - 12hr SLA)</option>
                <option value="LOW">Low (P3 - 24hr SLA)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Initial Assignee (Optional)
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              >
                <option value="">Leave Unassigned (Triage)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. kafka, database, tier1-client"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            />
          </div>

          {/* Approval Requirement Toggle */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(e) => setApprovalRequired(e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                Require Authorized Sign-Off Before Resolution
              </span>
            </label>
            {approvalRequired && (
              <div className="pt-2 pl-6 space-y-2">
                <p className="text-[11px] text-neutral-500">
                  Enforces workflow approval requirement. Only users with role APPROVER or TEAM_LEAD on the target team can approve.
                </p>
                <input
                  type="number"
                  placeholder="Optional monetary threshold (e.g. 50000)"
                  value={approvalThreshold || ''}
                  onChange={(e) => setApprovalThreshold(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full p-1.5 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-xs"
                />
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="text-[11px] font-mono text-neutral-400 truncate max-w-xs">
              Token: {idempotencyKey.slice(0, 18)}...
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Create Work Item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
