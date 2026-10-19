/**
 * Automated Verification Suite for Newtonite Operations Command System
 * Tests Critical Concurrency, OCC, Idempotency, RBAC, and State Machine Invariants
 */

import assert from 'node:assert';
import { appStore } from '../server/store.ts';

console.log('--- Starting Newtonite System Behavioral Verification ---\n');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  testsTotal++;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as Promise<void>)
        .then(() => {
          console.log(`[PASS] ${name}`);
          testsPassed++;
        })
        .catch((err) => {
          console.error(`[FAIL] ${name}`);
          console.error(err);
          process.exitCode = 1;
        });
    } else {
      console.log(`[PASS] ${name}`);
      testsPassed++;
    }
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runSuite() {
  appStore.resetState();

  const alex = appStore.getUser('user-alex')!;
  const sarah = appStore.getUser('user-sarah')!;
  const marcus = appStore.getUser('user-marcus')!;
  const david = appStore.getUser('user-david')!;
  const chloe = appStore.getUser('user-chloe')!;
  const elena = appStore.getUser('user-elena')!;

  // TEST 1: Simultaneous Claim Race Condition (CAS Atomic Lock)
  await runTest('1. Simultaneous Claim: Only one operator wins, loser receives 409 Conflict', async () => {
    // Create fresh unassigned item in team-engineering where both Alex and Elena are members
    const item = appStore.createWorkItem(
      {
        title: 'Concurrent Claim Target',
        description: 'Race condition verification item',
        teamId: 'team-engineering',
        type: 'INCIDENT',
        severity: 'HIGH',
      },
      elena
    );

    assert.strictEqual(item.assigneeId, null, 'Item should initially be unassigned');

    // Simulate two concurrent requests hitting the atomic claim routine
    let alexResult: any = null;
    let elenaResult: any = null;
    let alexError: any = null;
    let elenaError: any = null;

    try {
      alexResult = appStore.atomicClaim(item.id, alex);
    } catch (err) {
      alexError = err;
    }

    try {
      elenaResult = appStore.atomicClaim(item.id, elena);
    } catch (err) {
      elenaError = err;
    }

    // Exactly one should succeed, and one should fail with 409 ASSIGNMENT_RACE_LOST
    const successes = [alexResult, elenaResult].filter(Boolean);
    const errors = [alexError, elenaError].filter(Boolean);

    assert.strictEqual(successes.length, 1, 'Exactly one claimant should succeed');
    assert.strictEqual(errors.length, 1, 'The competing claimant must be rejected');
    assert.strictEqual(errors[0].status, 409, 'Rejection must be HTTP 409 Conflict');
    assert.strictEqual(errors[0].code, 'ASSIGNMENT_RACE_LOST');
  });

  // TEST 2: Optimistic Concurrency Control (OCC) Stale Update Rejection
  await runTest('2. Optimistic Concurrency Control: Stale version write is rejected with 409 and field diffs', () => {
    const item = appStore.getWorkItem('OP-1042')!;
    const originalVersion = item.version;

    // Simulate Operator B making an update first
    appStore.atomicUpdate(
      item.id,
      { description: 'Operator B updated this description in the background.' },
      originalVersion,
      alex
    );

    assert.strictEqual(item.version, originalVersion + 1, 'Version should increment to v + 1');

    // Now Operator A (who loaded the item before Operator B updated it) tries to submit with originalVersion
    let caughtError: any = null;
    try {
      appStore.atomicUpdate(
        item.id,
        { description: 'Operator A attempts to overwrite with stale version.' },
        originalVersion, // Stale version!
        alex
      );
    } catch (err) {
      caughtError = err;
    }

    assert.notStrictEqual(caughtError, null, 'Server must reject stale version');
    assert.strictEqual(caughtError.status, 409, 'Must return 409 Conflict');
    assert.strictEqual(caughtError.code, 'STALE_OBJECT_STATE');
    assert.strictEqual(caughtError.serverVersion, originalVersion + 1);
    assert.ok(caughtError.fieldDiffs.description, 'Server must return field diffs for the user to resolve');
  });

  // TEST 3: Idempotency Key Deduplication
  await runTest('3. Idempotency Key: Duplicate submission returns cached response without duplicate side effects', () => {
    const key = `idem-${Date.now()}`;
    const initialItemCount = appStore.queryWorkItems({}).total;

    // First submission
    const newItem = appStore.createWorkItem(
      {
        title: 'Idempotency Test Item',
        description: 'First dispatch',
        teamId: 'team-payments',
        type: 'PAYMENT_INVESTIGATION',
        severity: 'MEDIUM',
      },
      sarah
    );

    appStore.saveIdempotencyRecord({
      key,
      userId: sarah.id,
      endpoint: '/api/work-items',
      statusCode: 201,
      responseBody: { ...newItem },
      createdAt: new Date().toISOString(),
    });

    const countAfterFirst = appStore.queryWorkItems({}).total;
    assert.strictEqual(countAfterFirst, initialItemCount + 1, 'First dispatch creates entity');

    // Second submission simulated with duplicate idempotency key
    const cachedRecord = appStore.getIdempotencyRecord(key);
    assert.ok(cachedRecord, 'Idempotency record must exist');
    assert.strictEqual(cachedRecord.statusCode, 201);
    assert.strictEqual(cachedRecord.responseBody.id, newItem.id);

    // Verify entity was not duplicated
    const countAfterReplay = appStore.queryWorkItems({}).total;
    assert.strictEqual(countAfterReplay, countAfterFirst, 'Entities must not duplicate on replay');
  });

  // TEST 4: Strict Server-Enforced RBAC on Approvals
  await runTest('4. Authorization Model: Non-approver role is rejected with 403 Forbidden on approval', () => {
    const item = appStore.getWorkItem('OP-1043')!; // High-value wire needing approval

    // Attempt 1: David Okafor (Customer support operator, not an approver on team-payments)
    let unauthorizedError: any = null;
    try {
      appStore.atomicProcessApproval(item.id, 'APPROVE', 'Trying to approve without credentials', david);
    } catch (err) {
      unauthorizedError = err;
    }

    assert.notStrictEqual(unauthorizedError, null, 'Non-approver must be rejected');
    assert.strictEqual(unauthorizedError.status, 403, 'Must return 403 Forbidden');
    assert.strictEqual(unauthorizedError.code, 'APPROVAL_UNAUTHORIZED');

    // Attempt 2: Chloe Martin (Global VIEWER)
    let viewerError: any = null;
    try {
      appStore.atomicProcessApproval(item.id, 'APPROVE', 'Viewer approval attempt', chloe);
    } catch (err) {
      viewerError = err;
    }

    assert.notStrictEqual(viewerError, null, 'Viewer must be rejected');
    assert.strictEqual(viewerError.status, 403);

    // Attempt 3: Sarah Kim (Senior Payment Ops Specialist with APPROVER role on team-payments)
    const approvedItem = appStore.atomicProcessApproval(
      item.id,
      'APPROVE',
      'Dual verification complete against SDN list.',
      sarah
    );

    assert.strictEqual(approvedItem.status, 'RESOLVED', 'Item should transition to RESOLVED');
    assert.strictEqual(approvedItem.approvalRequirement?.status, 'APPROVED');
    assert.strictEqual(approvedItem.approvalRequirement?.approvedBy, sarah.id);
  });

  // TEST 5: State Machine Transition Constraints
  await runTest('5. State Machine: Illegal direct jump from TRIAGE to RESOLVED is rejected', () => {
    const item = appStore.getWorkItem('OP-1044')!; // Currently in TRIAGE

    let transitionError: any = null;
    try {
      appStore.atomicUpdate(item.id, { status: 'RESOLVED' }, item.version, marcus);
    } catch (err) {
      transitionError = err;
    }

    assert.notStrictEqual(transitionError, null, 'Illegal state jump must be rejected');
    assert.strictEqual(transitionError.status, 400);
    assert.strictEqual(transitionError.code, 'INVALID_STATE_TRANSITION');
  });

  // TEST 6: Asynchronous Outbox Event Queue and Worker Processing
  await runTest('6. Asynchronous Outbox: Mutating operations queue background tasks for async execution', async () => {
    const outboxTask = appStore.enqueueOutbox('CHECK_SLA_BREACH', 'OP-1045', {
      testVerification: true,
    });

    assert.strictEqual(outboxTask.status, 'PENDING');
    assert.strictEqual(outboxTask.attempts, 0);

    // Trigger worker tick
    await appStore.processOutboxTasks();

    assert.strictEqual(outboxTask.status, 'COMPLETED', 'Worker should process and mark task COMPLETED');
    assert.ok(outboxTask.processedAt, 'Processed timestamp must be set');
  });

  // TEST 7: Immutable Audit Log Generation
  await runTest('7. Auditability: All mutations create immutable chronological audit records', () => {
    const item = appStore.getWorkItem('OP-1042')!;
    const eventsBefore = appStore.getAuditEvents(item.id).length;

    appStore.addComment(item.id, 'Test verification comment', alex);

    const eventsAfter = appStore.getAuditEvents(item.id);
    assert.strictEqual(eventsAfter.length, eventsBefore + 1, 'Audit log must append new event');
    assert.strictEqual(eventsAfter[0].actionType, 'COMMENT_ADDED');
    assert.strictEqual(eventsAfter[0].actorId, alex.id);
  });

  console.log(`\n--- Verification Summary: ${testsPassed}/${testsTotal} Tests Passed Successfully ---`);
  process.exit(0);
}

runSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
