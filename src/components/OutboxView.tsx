/**
 * Outbox & Background Workers Inspector
 * Demonstrates the Transactional Outbox pattern, asynchronous job execution, and retry mechanisms
 */

import React, { useState, useEffect } from 'react';
import { OutboxTask } from '../shared/types.ts';
import { api } from '../services/api.ts';
import { Layers, RotateCcw, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface OutboxViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OutboxView: React.FC<OutboxViewProps> = ({ onShowToast }) => {
  const [tasks, setTasks] = useState<OutboxTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchOutbox = async () => {
    setIsLoading(true);
    try {
      const data = await api.getOutboxTasks();
      setTasks(data);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load outbox', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutbox();
    const interval = setInterval(fetchOutbox, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (taskId: string) => {
    setRetryingId(taskId);
    try {
      const updated = await api.retryOutboxTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      onShowToast(`Task ${taskId} re-queued for processing`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Retry failed', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: OutboxTask['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>COMPLETED</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>PENDING</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            <span>PROCESSING</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="font-mono text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>FAILED (DEAD-LETTER)</span>
          </span>
        );
    }
  };

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failedCount = tasks.filter((t) => t.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Pattern Explanation Banner */}
      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
            <span>Transactional Outbox Architecture</span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-3xl">
            Mutations write domain entities and asynchronous task records in the same transactional boundary.
            Secondary operations (webhooks, notification digests, SLA background checks) execute asynchronously
            via a resilient background worker with retries and dead-letter handling.
          </p>
        </div>

        <button
          onClick={fetchOutbox}
          className="p-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 self-start md:self-auto"
          title="Refresh outbox"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Completed Jobs</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {completedCount}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Pending Execution</div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {pendingCount}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 font-medium">Dead-Letter / Failed</div>
          <div className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1 tabular-nums">
            {failedCount}
          </div>
        </div>
      </div>

      {/* Task Queue Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 w-36">Task ID</th>
                <th className="py-2.5 px-3 w-28">Work Item</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 w-36">Status</th>
                <th className="py-2.5 px-3 w-24">Attempts</th>
                <th className="py-2.5 px-3 w-44">Scheduled / Processed</th>
                <th className="py-2.5 px-4 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-mono text-[11px]">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500 font-sans text-xs">
                    No asynchronous outbox tasks recorded yet.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40">
                    <td className="py-3 px-4 font-bold text-neutral-800 dark:text-neutral-200 truncate">
                      {task.id.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-3 text-neutral-900 dark:text-white font-bold">
                      {task.workItemId}
                    </td>
                    <td className="py-3 px-3 font-sans text-neutral-700 dark:text-neutral-300">
                      <div>{task.taskType}</div>
                      {task.lastError && (
                        <div className="text-[10px] text-red-500 font-mono mt-0.5">
                          Err: {task.lastError}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(task.status)}</td>
                    <td className="py-3 px-3 tabular-nums text-neutral-600 dark:text-neutral-400">
                      {task.attempts} / {task.maxAttempts}
                    </td>
                    <td className="py-3 px-3 text-neutral-500 text-[10px]">
                      <div>Sch: {new Date(task.scheduledAt).toLocaleTimeString()}</div>
                      {task.processedAt && (
                        <div>Done: {new Date(task.processedAt).toLocaleTimeString()}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {task.status === 'FAILED' && (
                        <button
                          disabled={retryingId === task.id}
                          onClick={() => handleRetry(task.id)}
                          className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded font-semibold text-[10px] hover:bg-neutral-800 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
