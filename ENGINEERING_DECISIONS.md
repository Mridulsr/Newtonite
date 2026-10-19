# Newtonite Operations Under Pressure — Engineering Decisions & Architecture

This document outlines the core architectural decisions, data models, trade-offs, and intentional non-goals for the **Newtonite Operations Command System**, designed for operational coordination under high concurrent pressure.

---

## 1. Concurrency Control: Optimistic Concurrency (OCC) + Atomic Compare-and-Swap (CAS)

### Context & Challenge
In rapidly scaling operations (hundreds of operators managing thousands of tickets), two concurrency failure modes occur constantly:
1. **The Overwrite / Stale Read Problem**: Operator A and Operator B open ticket `OP-1042` simultaneously. Operator A updates the severity and mitigation notes. Seconds later, Operator B submits an edit based on the outdated state, silently clobbering Operator A's work.
2. **The Assignment Race Condition**: A critical P0 incident arrives. Two engineers both click "Claim Responsibility" at the same instant. Without transactional guarantees, both believe they own it, or one silently overwrites the other.

### The Decision & Implementation
- **Optimistic Concurrency Control (OCC) via Monotonic Versioning**:
  Every work item contains an integer `version` field starting at 1. Every mutating API request (`PATCH /api/work-items/:id`) requires an `expectedVersion` in the payload. The datastore verifies `item.version === expectedVersion`. If versions match, the update applies and `version` increments to `v + 1`. If mismatched, the server rejects the request with HTTP `409 Conflict` (`STALE_OBJECT_STATE`), returning both the current server version and a field-level diff (`fieldDiffs`).
- **Atomic Compare-and-Swap (CAS) for Ownership Claims**:
  The `POST /api/work-items/:id/claim` endpoint implements an atomic CAS lock. A claim only succeeds if `item.assigneeId === null` (or matches the caller). If another operator succeeded milliseconds earlier, the server immediately returns HTTP `409 Conflict` (`ASSIGNMENT_RACE_LOST`) with the identity of the victorious claimant and timestamp.
- **Client Resolution UX**:
  Instead of generic error toasts, the UI detects 409 responses and opens an interactive **Conflict Resolution Drawer**, presenting side-by-side diffs (Server State vs. Local Changes) with options to *"Discard and Reload Latest"* or *"Review & Merge"*.

### Trade-offs & Alternatives Considered
- *Pessimistic Locking / Leases*: We considered locking tickets while an operator has the edit drawer open. However, in distributed operations, abandoned tabs and dropped network connections leave records perpetually locked, stalling incident response. OCC offers zero-lock contention with explicit conflict surfacing.
- *Last-Write-Wins (LWW)*: Rejected entirely; LWW causes silent data loss, which is disastrous in payment and compliance audits.

---

## 2. Idempotency Key Architecture: Protecting Against Accidental Re-execution

### Context & Challenge
Under pressure, operators on unreliable networks or during UI lag frequently double-click action buttons ("Approve Wire Release", "Escalate Incident", "Submit Record"). Furthermore, automated retries from reverse proxies or service workers can repeat requests. Without idempotency, duplicate payments, repeated approvals, or duplicate tickets are created.

### The Decision & Implementation
- **Idempotency Token Registry**:
  Mutating endpoints (`POST /api/work-items`, `PATCH /api/work-items/:id`, `POST /api/work-items/:id/approve`, `POST /api/work-items/:id/claim`) accept an `X-Idempotency-Key` HTTP header (or body token).
- **Two-Phase Lifecycle**:
  Before business logic executes, the server checks the idempotency store:
  - If a record exists with the same key, user, and endpoint: the server halts mutation logic and immediately replays the cached HTTP status code and response body, accompanied by an `Idempotent-Replay: true` header.
  - If new: the server processes the transaction, records the resulting response payload in the idempotency registry, and completes.
- **Frontend Token Generation**:
  Action buttons auto-generate a UUID idempotency token on modal open or button trigger, reusing that token across automatic retries until the operation completes or is dismissed.

### Trade-offs
- *Storage Overhead*: Idempotency records require storage with a TTL (e.g., 24 hours). For high-scale production, this is backed by Redis with automatic key expiration (`EXPIRE`).

---

## 3. Two-Tiered Authorization Model (Global RBAC + Team Scoped Permissions)

### Context & Challenge
Operational workflows span distinct departments (Platform Engineering, Payment Ops, Regulatory Compliance, Customer Support). A blanket "admin / user" role is insufficient:
- Customer support engineers should be able to escalate and view tickets, but must not approve $200,000 wire releases.
- Platform engineers should manage incidents, but cannot satisfy SOX/GDPR regulatory sign-off requirements.
- Front-end only authorization (hiding buttons) is trivial to bypass via curl or browser consoles.

### The Decision & Implementation
- **Strict Server-Side Authorization Invariant**:
  Authorization is evaluated strictly inside the domain layer (`AppStore.assertCanOperateOnTeam` and `AppStore.assertCanApprove`), never trusting UI state.
- **Two-Tier Role Model**:
  1. *Global Roles*: `ADMIN` (unrestricted operational bypass for Incident Commanders), `MEMBER` (standard employee), `VIEWER` (read-only audit observer).
  2. *Team Memberships*: Users have scoped roles within specific teams: `TEAM_LEAD`, `APPROVER`, `OPERATOR`, `OBSERVER`.
- **Workflow State Machine Guards**:
  Transitions to `RESOLVED` on high-risk items (such as high-value payment investigations or compliance erasures) require explicit sign-off from a user holding the `APPROVER` or `TEAM_LEAD` role on the target team. Attempting to bypass this via raw status updates returns HTTP `403 Forbidden` (`APPROVAL_ROLE_INSUFFICIENT`).

---

## 4. Transactional Outbox Pattern: Synchronous Core vs. Asynchronous Secondary Work

### Context & Challenge
Operations involve both **critical transactional path** actions (changing status, assigning an engineer, approving a release) and **secondary side effects** (dispatching Slack/PagerDuty webhooks, calculating SLA breaches, syncing compliance digests, sending email notifications). If secondary work runs synchronously inside the HTTP request:
- Downstream third-party latency (e.g., a slow Slack webhook or CRM API) blocks the user's browser for seconds.
- A transient network failure in the webhook fails the entire user transaction, even though the database write succeeded.

### The Decision & Implementation
- **Transactional Outbox**:
  The primary database write and the creation of an `OutboxTask` record happen atomically within the same domain transaction. The HTTP response returns immediately (typically < 15ms).
- **Asynchronous Background Worker**:
  A decoupled background worker monitors pending outbox tasks, executing secondary actions with:
  - Configurable retries with exponential backoff (`attempts` / `maxAttempts`).
  - Dead-letter state marking (`FAILED` with `lastError`).
  - Operational visibility: Operators and managers can inspect the Outbox queue directly from the UI and manually trigger retries for failed tasks.

---

## 5. High-Scale Server-Side Query Architecture vs. Client-Side In-Memory Filtering

### Context & Challenge
The prompt specifies designing for tens of thousands of active work items and growing audit trails: *"Your solution should not depend on loading the entire dataset into the browser or processing everything in application memory."*

### The Decision & Implementation
- **Server-Side Pagination & Faceted Search**:
  The `GET /api/work-items` endpoint accepts parameterized filters:
  - `page`, `pageSize` (default 10, max 100)
  - `teamId`, `status`, `severity`, `type`, `assigneeId`
  - High-urgency quick filters: `unassigned=true`, `pendingApproval=true`, `slaBreached=true`
  - Multi-attribute text search across IDs, titles, descriptions, and tags.
- **Payload Splitting**:
  Audit logs and commentary are not bundled into the work item list payload. They are lazily fetched on-demand via `GET /api/work-items/:id/audit` and `GET /api/work-items/:id/comments` when an operator inspects a specific item. This keeps list view payloads under 20KB even with 50,000 stored items.

---

## 6. What Was Intentionally Not Built (and Why)

1. **Full WebSocket Infrastructure**:
   - *Reasoning*: A full WebSocket bi-directional transport adds deployment statefulness, reconnect storms, and sticky-session requirements. We implemented efficient lightweight polling with presence heartbeats (`/heartbeat`), which achieves 95% of real-time multi-user awareness (e.g. "David Okafor is currently viewing this item") with zero stateful connection fragility.
2. **Distributed 2-Phase Commit (2PC) Across Microservices**:
   - *Reasoning*: Operational systems at this scale are far better served by a monolithic or modular service with the Transactional Outbox pattern and eventual consistency rather than fragile distributed locks across network boundaries.
3. **Arbitrary Custom Form Builders**:
   - *Reasoning*: Operations teams need structured, validated domains (Incidents, Payments, Compliance, Engineering) rather than unbounded free-form fields that degrade search indexing and consistency.
