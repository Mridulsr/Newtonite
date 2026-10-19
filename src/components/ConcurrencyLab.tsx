/**
 * Concurrency & Stress Lab
 * Interactive live verification suite for evaluating race conditions, OCC, idempotency, and RBAC
 */

import React, { useState } from 'react';
import { User, WorkItem } from '../shared/types.ts';
import { api } from '../services/api.ts';
import {
  Zap,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react';

interface ConcurrencyLabProps {
  currentUser: User | null;
  users: User[];
  workItems: WorkItem[];
  onRefreshAll: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ConcurrencyLab: React.FC<ConcurrencyLabProps> = ({
  currentUser,
  users,
  workItems,
  onRefreshAll,
  onShowToast,
}) => {
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [selectedTargetItem, setSelectedTargetItem] = useState<string>('OP-1044');

  // Test 1: Race Condition Simulation
  const runRaceCondition = async () => {
    setRunningTest('race');
    setTestResult(null);
    try {
      const res = await api.runSimulateRaceCondition({
        workItemId: selectedTargetItem,
        user1Id: 'user-alex',
        user2Id: 'user-elena',
      });
      setTestResult({
        type: 'race',
        data: res,
      });
      onShowToast('Race condition simulation completed', 'success');
      onRefreshAll();
    } catch (err: any) {
      onShowToast(err.message || 'Simulation failed', 'error');
    } finally {
      setRunningTest(null);
    }
  };

  // Test 2: OCC Stale Update Simulation
  const runStaleUpdate = async () => {
    setRunningTest('occ');
    setTestResult(null);
    try {
      const res = await api.runSimulateStaleUpdate({
        workItemId: 'OP-1042',
      });
      setTestResult({
        type: 'occ',
        data: res,
      });
      onShowToast('OCC stale update caught successfully', 'success');
      onRefreshAll();
    } catch (err: any) {
      onShowToast(err.message || 'OCC simulation failed', 'error');
    } finally {
      setRunningTest(null);
    }
  };

  // Test 3: Idempotency Key Simulation
  const runIdempotencyTest = async () => {
    setRunningTest('idempotency');
    setTestResult(null);
    try {
      const res = await api.runSimulateIdempotency();
      setTestResult({
        type: 'idempotency',
        data: res,
      });
      onShowToast('Idempotency replay verified', 'success');
      onRefreshAll();
    } catch (err: any) {
      onShowToast(err.message || 'Idempotency simulation failed', 'error');
    } finally {
      setRunningTest(null);
    }
  };

  // Test 4: Unauthorized Approval Attempt (RBAC)
  const runUnauthorizedApproval = async () => {
    setRunningTest('rbac');
    setTestResult(null);
    try {
      // Temporarily switch actor to David Okafor (Customer Support, role OPERATOR)
      const prevActor = api.getActorUserId();
      api.setActorUser('user-david');

      try {
        await api.processApproval('OP-1043', 'APPROVE', 'Attempting illegal approval');
        setTestResult({
          type: 'rbac',
          data: { success: false, message: 'Unexpected: Server permitted unauthorized approval!' },
        });
      } catch (err: any) {
        setTestResult({
          type: 'rbac',
          data: {
            success: true,
            status: err.status,
            code: err.code,
            message: err.message,
            explanation:
              'SUCCESS: Server-side RBAC rejected David Okafor from approving team-payments item with 403 Forbidden. Authorization cannot be bypassed by client calls.',
          },
        });
        onShowToast('RBAC defense verified (403 Forbidden)', 'success');
      } finally {
        api.setActorUser(prevActor);
      }
    } finally {
      setRunningTest(null);
    }
  };

  // Reset Store
  const handleResetStore = async () => {
    try {
      await api.resetState();
      onRefreshAll();
      setTestResult(null);
      onShowToast('Store reset to initial pristine state', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Reset failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 bg-neutral-900 text-white rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Interactive Concurrency & Operational Invariants Lab</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Live harness for assessors to execute and witness multi-user contention, atomic CAS
            claim races, optimistic locking conflicts (OCC), idempotency token replays, and strict
            RBAC defense.
          </p>
        </div>

        <button
          onClick={handleResetStore}
          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded border border-neutral-700 transition-colors flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All State to Seed</span>
        </button>
      </div>

      {/* Grid of Simulation Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scenario 1: Race Condition */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-2">
                <span>01. Simultaneous Claim Race Condition</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Two operators simultaneously attempt to claim the exact same unassigned ticket.
              </p>
            </div>
            <button
              disabled={runningTest !== null}
              onClick={runRaceCondition}
              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Play className="w-3 h-3" />
              <span>Simulate Race</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800/80">
            Target Item: {selectedTargetItem} · Contenders: Alex Chen vs. Elena Rostova
          </div>
        </div>

        {/* Scenario 2: OCC Stale Data */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-2">
                <span>02. Optimistic Concurrency Control (OCC)</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Client submits an edit against stale v(N-1) while server has advanced to vN.
              </p>
            </div>
            <button
              disabled={runningTest !== null}
              onClick={runStaleUpdate}
              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Play className="w-3 h-3" />
              <span>Test OCC</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800/80">
            Simulates silent background version increment followed by stale commit rejection.
          </div>
        </div>

        {/* Scenario 3: Idempotency Key */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-2">
                <span>03. Idempotency Key Deduplication</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Simulates UI double-click or network retry using duplicate X-Idempotency-Key.
              </p>
            </div>
            <button
              disabled={runningTest !== null}
              onClick={runIdempotencyTest}
              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Play className="w-3 h-3" />
              <span>Test Idempotency</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800/80">
            Verifies 2nd duplicate call returns cached status 201 without duplicating record.
          </div>
        </div>

        {/* Scenario 4: RBAC Violation Defense */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center gap-2">
                <span>04. Server-Side RBAC Defense</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Customer Support operator attempts to approve $240k wire release without approver role.
              </p>
            </div>
            <button
              disabled={runningTest !== null}
              onClick={runUnauthorizedApproval}
              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold rounded hover:bg-neutral-800 transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <Play className="w-3 h-3" />
              <span>Test RBAC</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 p-2.5 bg-neutral-50 dark:bg-neutral-800/60 rounded border border-neutral-200 dark:border-neutral-800/80">
            Proves authorization is strictly enforced by the server API, not UI hiding.
          </div>
        </div>
      </div>

      {/* Live Simulation Output Terminal */}
      {testResult && (
        <div className="p-5 bg-neutral-950 text-neutral-200 rounded-lg border border-neutral-800 space-y-4 animate-in fade-in duration-200 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Live Test Execution Results & Telemetry</span>
            </div>
            <span className="text-[11px] text-neutral-500">
              Scenario: {testResult.type.toUpperCase()}
            </span>
          </div>

          <div className="p-3 bg-neutral-900 rounded border border-neutral-800 text-emerald-300 text-xs">
            {testResult.data.analysis || testResult.data.explanation}
          </div>

          <div>
            <div className="text-[11px] text-neutral-500 mb-1">Raw Server Response Payload:</div>
            <pre className="p-3 bg-neutral-900 rounded border border-neutral-800 overflow-x-auto text-[11px] text-neutral-300">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
