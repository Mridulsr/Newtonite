# Newtonite Operations Command System
## Operations Under Pressure — Full-Stack Engineering Assessment

A production-grade operational coordination system engineered for high-concurrency enterprise environments where hundreds of operators handle thousands of urgent, high-risk work items (incidents, wire investigations, compliance requests, customer outages).

---

## Key Capabilities & Core Architectural Behaviors

### 1. Concurrency Controls & Race-Condition Defense
- **Atomic Compare-and-Swap (CAS) Ownership Claim**: When multiple operators click "Claim Responsibility" at the same instant on an unassigned item, the server atomic transaction guarantees that exactly one operator wins with `200 OK`. The competing operator immediately receives a structured `409 Conflict` (`ASSIGNMENT_RACE_LOST`) detailing who claimed it and when.
- **Optimistic Concurrency Control (OCC) with Monotonic Versioning**: Mutating updates require the client's observed `expectedVersion`. If another user modified the ticket in the background, the server rejects the write with `409 Conflict` (`STALE_OBJECT_STATE`), returning current server data and calculated field-level diffs.
- **Interactive Conflict Resolution**: The UI surfaces an interactive diff drawer allowing the user to either discard their local draft and reload the latest server state, or review field differences and force an intentional overwrite.
- **Active Presence / Heartbeat**: Real-time awareness displays active viewers currently reading or working on any ticket, preventing duplicate work before it begins.

### 2. Idempotency Key Architecture
- All mutating endpoints accept an `X-Idempotency-Key` HTTP header.
- Client action triggers generate UUID tokens. If an operator double-clicks an action button during network lag or if retries occur, the server immediately returns the cached original HTTP response with `Idempotent-Replay: true`, preventing duplicate payment approvals or duplicate ticket creations.

### 3. Server-Enforced Two-Tier Authorization (RBAC)
- **Global Roles**: `ADMIN`, `MEMBER`, `VIEWER`.
- **Scoped Team Roles**: `TEAM_LEAD`, `APPROVER`, `OPERATOR`, `OBSERVER`.
- **Workflow State Machine Guards**: High-risk actions (such as wire release approvals or GDPR compliance closures) require explicit `APPROVER` or `TEAM_LEAD` roles for that specific department. Client calls without proper authorization fail with `403 Forbidden` (`APPROVAL_ROLE_INSUFFICIENT`).

### 4. Transactional Outbox & Asynchronous Background Worker
- Mutating operations synchronously update the core record and append an `OutboxTask` within the same transaction.
- Secondary operations (SLA breach escalation, external webhook dispatch, email digests, compliance logging) execute asynchronously via a resilient background worker with retries, exponential backoff, and dead-letter queue monitoring.

### 5. High-Scale Server-Side Pagination & Faceted Search
- Scaled for tens of thousands of records without loading whole datasets into browser memory.
- Server-side multi-parameter querying: `page`, `pageSize`, `teamId`, `status`, `severity`, `type`, `unassigned`, `pendingApproval`, `slaBreached`, and full-text search.

---

## Setup & Running Instructions

### Prerequisites
- Node.js 20+
- npm

### Installation & Execution
```bash
# 1. Install dependencies
npm install

# 2. Run automated tests (verifies OCC, CAS race conditions, idempotency, RBAC, outbox)
npm test

# 3. Start development server (Express full-stack backend on http://0.0.0.0:3000)
npm run dev

# 4. Production build
npm run build
npm start
```

---

## Interactive Concurrency & Stress Lab
The application includes a built-in interactive **Concurrency Lab** (tab in top navigation) where assessors can trigger and observe live tests directly in the UI:
1. **Simultaneous Claim Race Condition**: Fires two parallel requests to claim an unassigned item. Observe atomic CAS resolve 1 winner and 1 loser with 409 Conflict.
2. **Stale Read (OCC) Collision**: Triggers an edit against an outdated version; watch server reject with 409 and field diffs.
3. **Idempotency Deduplication**: Fires identical tokens; watch the second call return a cached replay with zero side-effects.
4. **Server-Side RBAC Enforcement**: Attempts an approval with an unauthorized role; witness 403 Forbidden rejection.
5. **Reset Store**: Restores pristine seed state anytime.

---

## Automated Test Suite
Run the automated test suite with:
```bash
npm test
```
**Tests Covered:**
1. Simultaneous Claim Race Condition (CAS atomic lock).
2. Optimistic Concurrency Control (OCC) stale version write rejection (409 Conflict).
3. Idempotency Key deduplication and replay caching.
4. Authorization model: non-approver role rejected with 403 Forbidden on approval.
5. State machine: illegal direct transitions rejected.
6. Asynchronous Outbox: queueing and background worker execution.
7. Auditability: immutable chronological audit log generation.

---

## Known Limitations
1. **Presence Polling vs. WebSockets**: Presence and active viewer heartbeats currently poll every 8 seconds. In a global multi-region deployment, WebSockets or Server-Sent Events (SSE) backed by a Redis pub/sub cluster would reduce polling overhead.
2. **In-Memory Store Persistence**: The application datastore is currently an in-memory transactional store with seed data. In an enterprise production deployment, this would be backed by PostgreSQL with row-level locking (`SELECT ... FOR UPDATE`) or optimistic version checks (`WHERE id = $1 AND version = $2`).
3. **Idempotency Store TTL Cleanup**: Idempotency records are held in memory. In enterprise production, records would be stored in Redis with native key TTLs (`EXPIRE 86400`).
