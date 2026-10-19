/**
 * Conflict Resolution Modal
 * Surfaced when Optimistic Concurrency Control (OCC) detects stale client writes (HTTP 409)
 */

import React from 'react';
import { WorkItem } from '../shared/types.ts';
import { ApiError } from '../services/api.ts';
import { AlertTriangle, ArrowRight, RotateCcw, Check, X } from 'lucide-react';

interface ConflictModalProps {
  error: ApiError;
  localDraft: Partial<WorkItem>;
  onDiscardAndReload: (latestItem: WorkItem) => void;
  onForceOverwrite: (latestVersion: number, localDraft: Partial<WorkItem>) => void;
  onCancel: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  error,
  localDraft,
  onDiscardAndReload,
  onForceOverwrite,
  onCancel,
}) => {
  const serverItem = error.serverItem;
  const serverVersion = error.serverVersion || serverItem?.version || 2;
  const fieldDiffs = error.fieldDiffs || {};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-70">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
              Optimistic Concurrency Conflict (OCC 409)
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
          <p>
            Another operator submitted changes to{' '}
            <span className="font-mono font-bold text-neutral-900 dark:text-white">
              {serverItem?.id || 'this work item'}
            </span>{' '}
            while you were reviewing or editing it.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-amber-900 dark:text-amber-200 font-mono text-[11px] flex items-center justify-between">
            <span>Your Session Version: v{serverVersion - 1}</span>
            <span>&rarr;</span>
            <span className="font-bold">Current Server Version: v{serverVersion}</span>
          </div>
        </div>

        {/* Diff Comparison Table */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Detected Field Discrepancies:
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-neutral-100 dark:bg-neutral-800 p-2 font-semibold text-[11px] text-neutral-500 uppercase tracking-wider">
              <div>Field</div>
              <div>Your Local Edit</div>
              <div>Current on Server (v{serverVersion})</div>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {Object.keys(localDraft).map((key) => {
                const localVal = (localDraft as any)[key];
                const serverVal = serverItem ? (serverItem as any)[key] : undefined;
                return (
                  <div key={key} className="grid grid-cols-3 p-2.5 font-mono text-[11px] items-center">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      {key}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium truncate pr-2">
                      {String(localVal)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                      {String(serverVal)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resolution Options */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Keep Reviewing Locally
          </button>

          <div className="flex items-center gap-2">
            {serverItem && (
              <button
                onClick={() => onDiscardAndReload(serverItem)}
                className="px-3.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard My Changes & Reload Server v{serverVersion}</span>
              </button>
            )}

            <button
              onClick={() => onForceOverwrite(serverVersion, localDraft)}
              className="px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors"
            >
              Force Overwrite with My Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
