/**
 * In-Memory Transactional Store with Atomic Operations, OCC, Audit Logging, and Outbox Queue
 */

import {
  User,
  Team,
  WorkItem,
  AuditEvent,
  WorkItemComment,
  OutboxTask,
  IdempotencyRecord,
  WorkItemFilterParams,
  PaginatedResponse,
  WorkItemStatus,
  WorkItemSeverity,
  WorkItemType,
  AuditActionType,
  ActiveViewer,
} from '../src/shared/types.ts';

// Pre-seeded Users
export const SEED_USERS: User[] = [
  {
    id: 'user-elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@newtonite.com',
    title: 'Director of Operations & Incident Commander',
    department: 'Executive Operations',
    globalRole: 'ADMIN',
    teamMemberships: [
      { teamId: 'team-incident', role: 'TEAM_LEAD' },
      { teamId: 'team-engineering', role: 'TEAM_LEAD' },
      { teamId: 'team-payments', role: 'APPROVER' },
      { teamId: 'team-compliance', role: 'APPROVER' },
      { teamId: 'team-support', role: 'TEAM_LEAD' },
    ],
  },
  {
    id: 'user-alex',
    name: 'Alex Chen',
    email: 'alex.chen@newtonite.com',
    title: 'Staff Reliability Engineer',
    department: 'Core Infrastructure',
    globalRole: 'MEMBER',
    teamMemberships: [
      { teamId: 'team-incident', role: 'OPERATOR' },
      { teamId: 'team-engineering', role: 'TEAM_LEAD' },
    ],
  },
  {
    id: 'user-sarah',
    name: 'Sarah Kim',
    email: 'sarah.kim@newtonite.com',
    title: 'Senior Payment Ops Specialist & Finance Approver',
    department: 'Financial Operations',
    globalRole: 'MEMBER',
    teamMemberships: [
      { teamId: 'team-payments', role: 'APPROVER' },
      { teamId: 'team-compliance', role: 'OPERATOR' },
    ],
  },
  {
    id: 'user-marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@newtonite.com',
    title: 'Head of Compliance & Regulatory Audit',
    department: 'Legal & Risk',
    globalRole: 'MEMBER',
    teamMemberships: [
      { teamId: 'team-compliance', role: 'TEAM_LEAD' },
      { teamId: 'team-payments', role: 'APPROVER' },
    ],
  },
  {
    id: 'user-david',
    name: 'David Okafor',
    email: 'david.okafor@newtonite.com',
    title: 'Customer Support Escalation Tier-2',
    department: 'Customer Success',
    globalRole: 'MEMBER',
    teamMemberships: [
      { teamId: 'team-support', role: 'OPERATOR' },
      { teamId: 'team-incident', role: 'OBSERVER' },
    ],
  },
  {
    id: 'user-chloe',
    name: 'Chloe Martin',
    email: 'chloe.martin@newtonite.com',
    title: 'Junior Operations Analyst',
    department: 'Business Operations',
    globalRole: 'VIEWER',
    teamMemberships: [
      { teamId: 'team-support', role: 'OBSERVER' },
      { teamId: 'team-compliance', role: 'OBSERVER' },
    ],
  },
];

// Pre-seeded Teams
export const SEED_TEAMS: Team[] = [
  {
    id: 'team-incident',
    name: 'Incident Command',
    slug: 'incident-command',
    description: 'High-severity production outages, infra degradations, and customer impact coordination.',
    defaultApproverRole: 'TEAM_LEAD',
    leadUserId: 'user-elena',
    color: '#DC2626',
  },
  {
    id: 'team-payments',
    name: 'Payment Operations',
    slug: 'payment-ops',
    description: 'Reconciliations, disputed charges, large wires, fraud investigations, and processor failures.',
    defaultApproverRole: 'APPROVER',
    leadUserId: 'user-sarah',
    color: '#0284C7',
  },
  {
    id: 'team-engineering',
    name: 'Core Platform Engineering',
    slug: 'core-platform',
    description: 'Database deadlocks, queue backlog spikes, schema migrations, and service crashes.',
    defaultApproverRole: 'TEAM_LEAD',
    leadUserId: 'user-alex',
    color: '#16A34A',
  },
  {
    id: 'team-compliance',
    name: 'Regulatory & Compliance',
    slug: 'compliance-legal',
    description: 'SOX audits, GDPR right-to-be-forgotten requests, legal subpoenas, and access sign-offs.',
    defaultApproverRole: 'APPROVER',
    leadUserId: 'user-marcus',
    color: '#D97706',
  },
  {
    id: 'team-support',
    name: 'Customer Escalations',
    slug: 'customer-ops',
    description: 'Enterprise account escalations, SLA priority fixes, and operational work requests.',
    defaultApproverRole: 'OPERATOR',
    leadUserId: 'user-david',
    color: '#7C3AED',
  },
];

export class AppStore {
  private users: Map<string, User> = new Map();
  private teams: Map<string, Team> = new Map();
  private workItems: Map<string, WorkItem> = new Map();
  private auditEvents: AuditEvent[] = [];
  private comments: Map<string, WorkItemComment[]> = new Map();
  private outboxTasks: OutboxTask[] = [];
  private idempotencyRecords: Map<string, IdempotencyRecord> = new Map();
  private activeViewers: Map<string, Map<string, { userName: string; timestamp: number }>> = new Map();
  private isProcessingOutbox: boolean = false;

  constructor() {
    this.seed();
    this.startBackgroundWorker();
  }

  public seed() {
    this.users.clear();
    SEED_USERS.forEach((u) => this.users.set(u.id, { ...u }));

    this.teams.clear();
    SEED_TEAMS.forEach((t) => this.teams.set(t.id, { ...t }));

    this.workItems.clear();
    this.auditEvents = [];
    this.comments.clear();
    this.outboxTasks = [];
    this.idempotencyRecords.clear();

    const now = new Date();

    // 1. Critical Production Incident
    this.createWorkItemInternal(
      {
        id: 'OP-1042',
        title: 'Kafka Ingestion Lag Exceeding 1.2M Messages on Primary Cluster',
        description: 'Payment event consumer group stalled at partition 14. Downstream ledger reconciliation delayed by 45 minutes.',
        teamId: 'team-incident',
        type: 'INCIDENT',
        severity: 'CRITICAL',
        status: 'IN_PROGRESS',
        assigneeId: 'user-alex',
        createdBy: 'user-elena',
        createdAt: new Date(now.getTime() - 1000 * 60 * 75).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
        version: 3,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 45).toISOString(),
        slaBreached: false,
        tags: ['kafka', 'p0-incident', 'ledger-delay'],
        metadata: {
          affectedSystems: ['billing-pipeline', 'event-bus'],
          incidentWarRoom: '#inc-kafka-partition-stall',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-elena',
          summary: 'Incident opened due to automated cloud alert on partition 14 stall.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 75).toISOString(),
        },
        {
          actionType: 'CLAIMED',
          actorId: 'user-alex',
          summary: 'Alex Chen claimed responsibility for incident investigation.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 50).toISOString(),
        },
        {
          actionType: 'STATUS_CHANGED',
          actorId: 'user-alex',
          summary: 'Transitioned from TRIAGE to IN_PROGRESS. Consumer node restarted; watching drain rate.',
          diff: {
            status: { before: 'TRIAGE', after: 'IN_PROGRESS' },
          },
          timestamp: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
        },
      ]
    );

    // 2. High-value Wire Transfer Investigation requiring approval
    this.createWorkItemInternal(
      {
        id: 'OP-1043',
        title: 'Escrow Release Authorization for $240,000 Apex Supply Wire',
        description: 'Sanctions check flagged beneficiary entity name similarity. Requires dual sign-off before releasing held funds.',
        teamId: 'team-payments',
        type: 'PAYMENT_INVESTIGATION',
        severity: 'HIGH',
        status: 'PENDING_APPROVAL',
        assigneeId: 'user-sarah',
        createdBy: 'user-david',
        createdAt: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
        version: 2,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
        slaBreached: false,
        approvalRequirement: {
          requiredRole: 'APPROVER',
          requiredTeamId: 'team-payments',
          status: 'PENDING',
          thresholdAmount: 240000,
          notes: 'Secondary proof of incorporation verified against OFAC SDN list.',
        },
        tags: ['wire-release', 'compliance-hold', 'high-value'],
        metadata: {
          wireReference: 'WT-20261019-9941',
          sourceAccount: 'Escrow-Operating-04',
          destinationCountry: 'United Kingdom',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-david',
          summary: 'Escalated from tier-1 support after automated wire hold triggered.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 180).toISOString(),
        },
        {
          actionType: 'APPROVAL_REQUESTED',
          actorId: 'user-sarah',
          summary: 'Sarah Kim requested authorized sign-off from Marcus Vance or Elena Rostova.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
        },
      ]
    );

    // 3. Unassigned Urgent Compliance Request
    this.createWorkItemInternal(
      {
        id: 'OP-1044',
        title: 'GDPR Right to Erasure: Batch #892 Enterprise Client Records',
        description: 'Statutory 30-day deadline approaching in 3 hours. Needs cryptographic confirmation of deleted backups across all cold stores.',
        teamId: 'team-compliance',
        type: 'COMPLIANCE_REQUEST',
        severity: 'HIGH',
        status: 'TRIAGE',
        assigneeId: null,
        createdBy: 'user-marcus',
        createdAt: new Date(now.getTime() - 1000 * 60 * 300).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 40).toISOString(),
        version: 1,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 180).toISOString(),
        slaBreached: false,
        tags: ['gdpr', 'erasure', 'legal-risk'],
        metadata: {
          requestorEmail: 'dpo@partnerclient.eu',
          jurisdiction: 'EU-GDPR',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-marcus',
          summary: 'Marcus Vance lodged compliance erasure dossier from EU Data Protection Office.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 300).toISOString(),
        },
      ]
    );

    // 4. Overdue SLA Breached Incident
    this.createWorkItemInternal(
      {
        id: 'OP-1045',
        title: 'PostgreSQL Read-Replica Connection Pool Exhaustion on US-East',
        description: 'Read traffic spiked to 14,000 QPS during morning batch jobs. Poolers rejected 4.8% of inbound reporting queries.',
        teamId: 'team-engineering',
        type: 'INCIDENT',
        severity: 'CRITICAL',
        status: 'TRIAGE',
        assigneeId: null,
        createdBy: 'user-alex',
        createdAt: new Date(now.getTime() - 1000 * 60 * 240).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
        version: 1,
        slaDeadline: new Date(now.getTime() - 1000 * 60 * 60).toISOString(), // Breached!
        slaBreached: true,
        tags: ['postgres', 'pool-exhaustion', 'overdue-sla'],
        metadata: {
          cluster: 'pg-replica-useast-02',
          connectionCount: 1200,
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-alex',
          summary: 'Opened ticket after PgBouncer logged max client connections reached.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 240).toISOString(),
        },
        {
          actionType: 'SLA_BREACH_DETECTED',
          actorId: 'system',
          summary: 'Automated SLA monitor flagged ticket as breached (1-hour resolution window expired).',
          timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
        },
      ]
    );

    // 5. Customer Escalation
    this.createWorkItemInternal(
      {
        id: 'OP-1046',
        title: 'Enterprise Billing Sync Failure: Vertex Global Multi-Currency Invoicing',
        description: 'Client billed in EUR instead of GBP exchange conversion. Total discrepancy £14,250.',
        teamId: 'team-support',
        type: 'CUSTOMER_ESCALATION',
        severity: 'MEDIUM',
        status: 'IN_PROGRESS',
        assigneeId: 'user-david',
        createdBy: 'user-david',
        createdAt: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
        version: 2,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 720).toISOString(),
        slaBreached: false,
        tags: ['billing-sync', 'fx-conversion', 'enterprise-tier1'],
        metadata: {
          clientName: 'Vertex Global Holdings',
          invoiceNumber: 'INV-2026-8819',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-david',
          summary: 'Received urgent escalation via Account Executive.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
        },
        {
          actionType: 'CLAIMED',
          actorId: 'user-david',
          summary: 'David Okafor claimed ticket and initiated credit adjustment draft.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
        },
      ]
    );

    // 6. Operational Task
    this.createWorkItemInternal(
      {
        id: 'OP-1047',
        title: 'Emergency IAM Role Revocation: Deprecated Bastion Key Rotation',
        description: 'Quarterly access rotation identified 3 unrotated SSH credentials in sandbox cluster.',
        teamId: 'team-engineering',
        type: 'OPERATIONAL_TASK',
        severity: 'MEDIUM',
        status: 'RESOLVED',
        assigneeId: 'user-alex',
        createdBy: 'user-elena',
        createdAt: new Date(now.getTime() - 1000 * 60 * 480).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 150).toISOString(),
        version: 4,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 1200).toISOString(),
        slaBreached: false,
        tags: ['security', 'iam-rotation', 'bastion'],
        metadata: {
          auditReference: 'SEC-2026-Q4-08',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-elena',
          summary: 'Created task for bastion security compliance.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 480).toISOString(),
        },
        {
          actionType: 'CLAIMED',
          actorId: 'user-alex',
          summary: 'Alex Chen claimed task.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 300).toISOString(),
        },
        {
          actionType: 'STATUS_CHANGED',
          actorId: 'user-alex',
          summary: 'Completed key revocation and terraform deployment.',
          diff: {
            status: { before: 'IN_PROGRESS', after: 'RESOLVED' },
          },
          timestamp: new Date(now.getTime() - 1000 * 60 * 150).toISOString(),
        },
      ]
    );

    // 7. Payment Investigation - Blocked
    this.createWorkItemInternal(
      {
        id: 'OP-1048',
        title: 'Stripe Payout Reversal: Chargeback Spike on Merchant #4109',
        description: 'Chargeback ratio spiked to 1.82% over weekend flash sale. Automatic reserve threshold reached.',
        teamId: 'team-payments',
        type: 'PAYMENT_INVESTIGATION',
        severity: 'HIGH',
        status: 'BLOCKED',
        assigneeId: 'user-sarah',
        createdBy: 'user-sarah',
        createdAt: new Date(now.getTime() - 1000 * 60 * 600).toISOString(),
        updatedAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        version: 2,
        slaDeadline: new Date(now.getTime() + 1000 * 60 * 300).toISOString(),
        slaBreached: false,
        tags: ['chargeback', 'merchant-reserve', 'dispute'],
        metadata: {
          merchantId: 'M-4109',
          reserveHeld: '$38,500',
        },
      },
      [
        {
          actionType: 'CREATED',
          actorId: 'user-sarah',
          summary: 'Sarah Kim detected processor notification of reserve threshold breach.',
          timestamp: new Date(now.getTime() - 1000 * 60 * 600).toISOString(),
        },
        {
          actionType: 'STATUS_CHANGED',
          actorId: 'user-sarah',
          summary: 'Marked BLOCKED awaiting proof of fulfillment delivery tracking from merchant.',
          diff: {
            status: { before: 'IN_PROGRESS', after: 'BLOCKED' },
          },
          timestamp: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        },
      ]
    );

    // Seed some initial comments
    this.addCommentInternal({
      id: 'comm-1',
      workItemId: 'OP-1042',
      userId: 'user-alex',
      userName: 'Alex Chen',
      userEmail: 'alex.chen@newtonite.com',
      content: 'I verified consumer offset lag on broker 3. Node memory is healthy; restarting workers with batch size 250.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
    });

    this.addCommentInternal({
      id: 'comm-2',
      workItemId: 'OP-1043',
      userId: 'user-sarah',
      userName: 'Sarah Kim',
      userEmail: 'sarah.kim@newtonite.com',
      content: 'I cross-referenced the beneficiary address with Companies House filings. Looks like a false positive hit on the parent company name.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    });
  }

  private createWorkItemInternal(item: WorkItem, events: Array<Omit<AuditEvent, 'id' | 'workItemId' | 'actorName' | 'actorEmail'>>) {
    this.workItems.set(item.id, item);
    events.forEach((ev) => {
      const user = this.users.get(ev.actorId) || { name: 'System Automator', email: 'system@newtonite.com' };
      this.auditEvents.push({
        id: `aud-${Math.random().toString(36).substring(2, 9)}`,
        workItemId: item.id,
        actorId: ev.actorId,
        actorName: user.name,
        actorEmail: user.email,
        actionType: ev.actionType,
        summary: ev.summary,
        diff: ev.diff,
        timestamp: ev.timestamp,
      });
    });
  }

  private addCommentInternal(comm: WorkItemComment) {
    const list = this.comments.get(comm.workItemId) || [];
    list.push(comm);
    this.comments.set(comm.workItemId, list);
    const item = this.workItems.get(comm.workItemId);
    if (item) {
      item.commentCount = list.length;
    }
  }

  // --- Background Outbox Queue Worker ---
  private startBackgroundWorker() {
    const timer = setInterval(() => {
      this.processOutboxTasks();
    }, 2500);
    if (timer.unref) {
      timer.unref();
    }
  }

  public async processOutboxTasks() {
    if (this.isProcessingOutbox) return;
    this.isProcessingOutbox = true;

    try {
      const pendingTasks = this.outboxTasks.filter((t) => t.status === 'PENDING');
      for (const task of pendingTasks) {
        task.status = 'PROCESSING';
        task.attempts += 1;

        try {
          // Simulate async processing execution logic
          if (task.taskType === 'CHECK_SLA_BREACH') {
            const item = this.workItems.get(task.workItemId);
            if (item && item.status !== 'RESOLVED' && item.status !== 'CLOSED') {
              const deadline = new Date(item.slaDeadline).getTime();
              if (Date.now() > deadline && !item.slaBreached) {
                item.slaBreached = true;
                item.version += 1;
                item.updatedAt = new Date().toISOString();
                this.logAudit({
                  workItemId: item.id,
                  actorId: 'system',
                  actionType: 'SLA_BREACH_DETECTED',
                  summary: 'Background SLA monitor flagged ticket as breached.',
                });
              }
            }
          } else if (task.taskType === 'DISPATCH_WEBHOOK') {
            // Emulate reliable external webhook with 98% success rate
            if (task.payload.simulateFailure && task.attempts < task.maxAttempts) {
              throw new Error('Remote webhook endpoint returned 503 Service Unavailable');
            }
          }

          task.status = 'COMPLETED';
          task.processedAt = new Date().toISOString();
        } catch (err: any) {
          task.lastError = err.message || 'Unknown processing error';
          if (task.attempts >= task.maxAttempts) {
            task.status = 'FAILED';
          } else {
            task.status = 'PENDING'; // Retry on next cycle
          }
        }
      }
    } finally {
      this.isProcessingOutbox = false;
    }
  }

  public enqueueOutbox(taskType: OutboxTask['taskType'], workItemId: string, payload: Record<string, any> = {}, maxAttempts = 3) {
    const task: OutboxTask = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workItemId,
      taskType,
      payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts,
      scheduledAt: new Date().toISOString(),
    };
    this.outboxTasks.unshift(task);
    if (this.outboxTasks.length > 200) {
      this.outboxTasks.pop();
    }
    return task;
  }

  public getOutboxTasks(): OutboxTask[] {
    return [...this.outboxTasks];
  }

  public retryOutboxTask(taskId: string): OutboxTask | null {
    const task = this.outboxTasks.find((t) => t.id === taskId);
    if (!task) return null;
    task.status = 'PENDING';
    task.attempts = 0;
    task.lastError = undefined;
    return task;
  }

  // --- Idempotency Management ---
  public getIdempotencyRecord(key: string): IdempotencyRecord | undefined {
    return this.idempotencyRecords.get(key);
  }

  public saveIdempotencyRecord(record: IdempotencyRecord) {
    this.idempotencyRecords.set(record.key, record);
  }

  // --- Audit Logging ---
  public logAudit(params: {
    workItemId: string;
    actorId: string;
    actionType: AuditActionType;
    summary: string;
    diff?: Record<string, { before: any; after: any }>;
  }): AuditEvent {
    const user = this.users.get(params.actorId) || {
      id: params.actorId,
      name: params.actorId === 'system' ? 'System Automator' : 'Unknown User',
      email: params.actorId === 'system' ? 'system@newtonite.internal' : 'unknown@newtonite.com',
    };

    const event: AuditEvent = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workItemId: params.workItemId,
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actionType: params.actionType,
      summary: params.summary,
      diff: params.diff,
      timestamp: new Date().toISOString(),
    };

    this.auditEvents.unshift(event);
    return event;
  }

  public getAuditEvents(workItemId?: string): AuditEvent[] {
    if (!workItemId) return this.auditEvents;
    return this.auditEvents.filter((ev) => ev.workItemId === workItemId);
  }

  // --- Active Viewers / Presence Tracking ---
  public recordHeartbeat(workItemId: string, userId: string, userName: string) {
    let viewers = this.activeViewers.get(workItemId);
    if (!viewers) {
      viewers = new Map();
      this.activeViewers.set(workItemId, viewers);
    }
    viewers.set(userId, { userName, timestamp: Date.now() });
  }

  public getActiveViewers(workItemId: string): ActiveViewer[] {
    const viewers = this.activeViewers.get(workItemId);
    if (!viewers) return [];
    const threshold = Date.now() - 30 * 1000; // 30s timeout
    const active: ActiveViewer[] = [];
    for (const [userId, record] of viewers.entries()) {
      if (record.timestamp > threshold) {
        active.push({
          userId,
          userName: record.userName,
          lastSeen: new Date(record.timestamp).toISOString(),
        });
      } else {
        viewers.delete(userId);
      }
    }
    return active;
  }

  // --- Users & Teams ---
  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public getTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  public getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  // --- Work Items Queries (Filter, Paginate, Search) ---
  public queryWorkItems(params: WorkItemFilterParams): PaginatedResponse<WorkItem> {
    let items = Array.from(this.workItems.values());

    // SLA auto-check
    const now = Date.now();
    for (const item of items) {
      if (item.status !== 'RESOLVED' && item.status !== 'CLOSED') {
        const deadline = new Date(item.slaDeadline).getTime();
        if (now > deadline && !item.slaBreached) {
          item.slaBreached = true;
        }
      }
    }

    // Filter by team
    if (params.teamId && params.teamId !== 'all') {
      items = items.filter((i) => i.teamId === params.teamId);
    }

    // Filter by status
    if (params.status && params.status !== 'all') {
      items = items.filter((i) => i.status === params.status);
    }

    // Filter by severity
    if (params.severity && params.severity !== 'all') {
      items = items.filter((i) => i.severity === params.severity);
    }

    // Filter by type
    if (params.type && params.type !== 'all') {
      items = items.filter((i) => i.type === params.type);
    }

    // Filter by assignee
    if (params.assigneeId) {
      if (params.assigneeId === 'unassigned') {
        items = items.filter((i) => !i.assigneeId);
      } else {
        items = items.filter((i) => i.assigneeId === params.assigneeId);
      }
    }

    // Unassigned quick filter
    if (params.unassigned) {
      items = items.filter((i) => !i.assigneeId);
    }

    // Pending approval filter
    if (params.pendingApproval) {
      items = items.filter((i) => i.status === 'PENDING_APPROVAL');
    }

    // SLA breached filter
    if (params.slaBreached) {
      items = items.filter((i) => i.slaBreached);
    }

    // Full-text Search
    if (params.search) {
      const q = params.search.toLowerCase().trim();
      items = items.filter((i) => {
        return (
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    // Sorting
    const sortBy = params.sortBy || 'updatedAt';
    const sortOrder = params.sortOrder || 'desc';

    items.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'updatedAt') {
        comp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortBy === 'createdAt') {
        comp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'slaDeadline') {
        comp = new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
      } else if (sortBy === 'severity') {
        const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        comp = severityRank[a.severity] - severityRank[b.severity];
      }
      return sortOrder === 'desc' ? -comp : comp;
    });

    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 10));
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIdx, startIdx + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public getWorkItem(id: string): WorkItem | undefined {
    return this.workItems.get(id);
  }

  // --- ATOMIC MUTATION 1: Atomic Claim / Race-Condition Guard ---
  public atomicClaim(workItemId: string, actor: User, forceReassign = false): WorkItem {
    const item = this.workItems.get(workItemId);
    if (!item) {
      throw { status: 404, message: `Work item ${workItemId} not found` };
    }

    // Authorization check
    this.assertCanOperateOnTeam(actor, item.teamId);

    // If item is already assigned to someone else
    if (item.assigneeId && item.assigneeId !== actor.id) {
      if (!forceReassign) {
        const currentAssignee = this.users.get(item.assigneeId);
        throw {
          status: 409,
          code: 'ASSIGNMENT_RACE_LOST',
          message: `Item has already been claimed by ${currentAssignee?.name || 'another operator'}.`,
          currentAssignee: currentAssignee
            ? { id: currentAssignee.id, name: currentAssignee.name, email: currentAssignee.email }
            : null,
          claimedAt: item.updatedAt,
        };
      }
    }

    const previousAssigneeId = item.assigneeId;
    item.assigneeId = actor.id;
    if (item.status === 'TRIAGE') {
      item.status = 'IN_PROGRESS';
    }
    item.version += 1;
    item.updatedAt = new Date().toISOString();

    const previousAssignee = previousAssigneeId ? this.users.get(previousAssigneeId) : null;
    this.logAudit({
      workItemId: item.id,
      actorId: actor.id,
      actionType: previousAssigneeId ? 'REASSIGNED' : 'CLAIMED',
      summary: previousAssigneeId
        ? `${actor.name} re-assigned ticket from ${previousAssignee?.name || 'previous operator'} to themselves.`
        : `${actor.name} took ownership of ticket.`,
      diff: {
        assigneeId: { before: previousAssigneeId, after: actor.id },
      },
    });

    this.enqueueOutbox('NOTIFY_TEAM_LEAD', item.id, {
      actorId: actor.id,
      teamId: item.teamId,
      action: 'CLAIMED',
    });

    return item;
  }

  // --- ATOMIC MUTATION 2: Optimistic Concurrency Control (OCC) Update ---
  public atomicUpdate(
    workItemId: string,
    updates: Partial<WorkItem>,
    expectedVersion: number,
    actor: User
  ): WorkItem {
    const item = this.workItems.get(workItemId);
    if (!item) {
      throw { status: 404, message: `Work item ${workItemId} not found` };
    }

    // Authorization check: User must have write permission on item team
    this.assertCanOperateOnTeam(actor, item.teamId);

    // OCC Check: Reject if version does not match
    if (item.version !== expectedVersion) {
      const fieldDiffs: Record<string, { expected: any; currentOnServer: any }> = {};
      for (const [k, v] of Object.entries(updates)) {
        if ((item as any)[k] !== v) {
          fieldDiffs[k] = {
            expected: v,
            currentOnServer: (item as any)[k],
          };
        }
      }

      throw {
        status: 409,
        code: 'STALE_OBJECT_STATE',
        message: `Conflict: This work item was modified by another operator while you were viewing it. (Your version: v${expectedVersion}, Current version: v${item.version})`,
        serverVersion: item.version,
        serverItem: { ...item },
        fieldDiffs,
      };
    }

    // State machine validation if status is changing
    if (updates.status && updates.status !== item.status) {
      this.validateStatusTransition(item.status, updates.status, item, actor);
    }

    const diff: Record<string, { before: any; after: any }> = {};
    const trackedKeys: Array<keyof WorkItem> = [
      'title',
      'description',
      'status',
      'severity',
      'teamId',
      'assigneeId',
      'slaDeadline',
    ];

    for (const key of trackedKeys) {
      if (updates[key] !== undefined && updates[key] !== item[key]) {
        diff[key] = { before: item[key], after: updates[key] };
        (item as any)[key] = updates[key];
      }
    }

    if (updates.tags) {
      item.tags = [...updates.tags];
    }

    if (updates.metadata) {
      item.metadata = { ...item.metadata, ...updates.metadata };
    }

    item.version += 1;
    item.updatedAt = new Date().toISOString();

    this.logAudit({
      workItemId: item.id,
      actorId: actor.id,
      actionType: diff['status'] ? 'STATUS_CHANGED' : 'FIELD_UPDATED',
      summary: `${actor.name} updated work item properties (${Object.keys(diff).join(', ')}).`,
      diff,
    });

    this.enqueueOutbox('CHECK_SLA_BREACH', item.id, {
      actorId: actor.id,
      newStatus: item.status,
    });

    return item;
  }

  // --- ATOMIC MUTATION 3: Workflow State Machine & Approval Enforcement ---
  public atomicProcessApproval(
    workItemId: string,
    action: 'APPROVE' | 'REJECT',
    notes: string,
    actor: User
  ): WorkItem {
    const item = this.workItems.get(workItemId);
    if (!item) {
      throw { status: 404, message: `Work item ${workItemId} not found` };
    }

    if (item.status !== 'PENDING_APPROVAL') {
      throw {
        status: 400,
        message: `Work item is not awaiting approval (current status: ${item.status}).`,
      };
    }

    // Role Enforcement: Approver check
    this.assertCanApprove(actor, item);

    const prevApproval = item.approvalRequirement || {
      requiredRole: 'APPROVER',
      status: 'PENDING',
    };

    if (action === 'APPROVE') {
      item.approvalRequirement = {
        ...prevApproval,
        status: 'APPROVED',
        approvedBy: actor.id,
        approvedAt: new Date().toISOString(),
        notes: notes || 'Approved without additional notes.',
      };
      item.status = 'RESOLVED';
    } else {
      item.approvalRequirement = {
        ...prevApproval,
        status: 'REJECTED',
        approvedBy: actor.id,
        approvedAt: new Date().toISOString(),
        notes: notes || 'Rejected by approver.',
      };
      item.status = 'IN_PROGRESS'; // return back to in progress for remedy
    }

    item.version += 1;
    item.updatedAt = new Date().toISOString();

    this.logAudit({
      workItemId: item.id,
      actorId: actor.id,
      actionType: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      summary: `${actor.name} (${actor.title}) ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'} the request. Reason: ${notes || 'None provided'}`,
      diff: {
        status: { before: 'PENDING_APPROVAL', after: item.status },
        approvalStatus: { before: 'PENDING', after: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' },
      },
    });

    this.enqueueOutbox('DISPATCH_WEBHOOK', item.id, {
      actorId: actor.id,
      approvalStatus: action,
      notes,
    });

    return item;
  }

  private nextWorkItemNumber = 1050;

  // --- Work Item Creation ---
  public createWorkItem(data: {
    title: string;
    description: string;
    teamId: string;
    type: WorkItemType;
    severity: WorkItemSeverity;
    assigneeId?: string | null;
    tags?: string[];
    metadata?: Record<string, any>;
    approvalRequired?: boolean;
    approvalThreshold?: number;
    customSlaMinutes?: number;
  }, actor: User): WorkItem {
    this.assertCanOperateOnTeam(actor, data.teamId);

    const id = `OP-${this.nextWorkItemNumber++}`;
    const now = new Date();

    // Default SLAs
    const defaultSlaMinutes: Record<WorkItemSeverity, number> = {
      CRITICAL: 60,
      HIGH: 240,
      MEDIUM: 720,
      LOW: 1440,
    };
    const slaMinutes = data.customSlaMinutes || defaultSlaMinutes[data.severity];
    const slaDeadline = new Date(now.getTime() + slaMinutes * 60 * 1000).toISOString();

    const approvalRequirement = data.approvalRequired
      ? {
          requiredRole: 'APPROVER' as const,
          requiredTeamId: data.teamId,
          status: 'PENDING' as const,
          thresholdAmount: data.approvalThreshold,
        }
      : undefined;

    const initialStatus: WorkItemStatus = data.approvalRequired
      ? 'PENDING_APPROVAL'
      : data.assigneeId
      ? 'IN_PROGRESS'
      : 'TRIAGE';

    const item: WorkItem = {
      id,
      title: data.title.trim(),
      description: data.description.trim(),
      teamId: data.teamId,
      type: data.type,
      severity: data.severity,
      status: initialStatus,
      assigneeId: data.assigneeId || null,
      createdBy: actor.id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1,
      slaDeadline,
      slaBreached: false,
      approvalRequirement,
      tags: data.tags || [],
      metadata: data.metadata || {},
      commentCount: 0,
    };

    this.workItems.set(item.id, item);

    this.logAudit({
      workItemId: item.id,
      actorId: actor.id,
      actionType: 'CREATED',
      summary: `${actor.name} created work item [${item.severity}] ${item.title}.`,
    });

    this.enqueueOutbox('CHECK_SLA_BREACH', item.id, {
      createdAt: item.createdAt,
      slaDeadline: item.slaDeadline,
    });

    return item;
  }

  // --- Comments ---
  public addComment(workItemId: string, content: string, actor: User): WorkItemComment {
    const item = this.workItems.get(workItemId);
    if (!item) {
      throw { status: 404, message: `Work item ${workItemId} not found` };
    }

    const comment: WorkItemComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workItemId,
      userId: actor.id,
      userName: actor.name,
      userEmail: actor.email,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    const list = this.comments.get(workItemId) || [];
    list.push(comment);
    this.comments.set(workItemId, list);
    item.commentCount = list.length;

    this.logAudit({
      workItemId: item.id,
      actorId: actor.id,
      actionType: 'COMMENT_ADDED',
      summary: `${actor.name} added a comment.`,
    });

    return comment;
  }

  public getComments(workItemId: string): WorkItemComment[] {
    return this.comments.get(workItemId) || [];
  }

  // --- Permission / RBAC Helpers ---
  public assertCanOperateOnTeam(actor: User, teamId: string) {
    if (actor.globalRole === 'ADMIN') return; // Admins have system-wide access

    const membership = actor.teamMemberships.find((m) => m.teamId === teamId);
    if (!membership) {
      throw {
        status: 403,
        code: 'ACCESS_DENIED_NOT_TEAM_MEMBER',
        message: `Forbidden: User ${actor.name} is not a member of team ${teamId}.`,
      };
    }

    if (actor.globalRole === 'VIEWER' || membership.role === 'OBSERVER') {
      throw {
        status: 403,
        code: 'ACCESS_DENIED_READ_ONLY',
        message: `Forbidden: User ${actor.name} has read-only observer permissions on team ${teamId}.`,
      };
    }
  }

  public assertCanApprove(actor: User, item: WorkItem) {
    if (actor.globalRole === 'ADMIN') return;

    const targetTeamId = item.approvalRequirement?.requiredTeamId || item.teamId;
    const membership = actor.teamMemberships.find((m) => m.teamId === targetTeamId);

    if (!membership) {
      throw {
        status: 403,
        code: 'APPROVAL_UNAUTHORIZED',
        message: `Forbidden: ${actor.name} does not belong to the approving team (${targetTeamId}).`,
      };
    }

    const allowedRoles = ['APPROVER', 'TEAM_LEAD'];
    if (!allowedRoles.includes(membership.role)) {
      throw {
        status: 403,
        code: 'APPROVAL_ROLE_INSUFFICIENT',
        message: `Forbidden: Approvals require APPROVER or TEAM_LEAD role. Your role in team ${targetTeamId} is ${membership.role}.`,
      };
    }
  }

  private validateStatusTransition(
    current: WorkItemStatus,
    target: WorkItemStatus,
    item: WorkItem,
    actor: User
  ) {
    const allowedTransitions: Record<WorkItemStatus, WorkItemStatus[]> = {
      TRIAGE: ['IN_PROGRESS', 'BLOCKED', 'CLOSED'],
      IN_PROGRESS: ['PENDING_APPROVAL', 'BLOCKED', 'RESOLVED'],
      PENDING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
      BLOCKED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: ['IN_PROGRESS'],
    };

    if (!allowedTransitions[current]?.includes(target)) {
      throw {
        status: 400,
        code: 'INVALID_STATE_TRANSITION',
        message: `Invalid state transition: Cannot move work item directly from ${current} to ${target}.`,
      };
    }

    if (target === 'RESOLVED' && item.approvalRequirement && item.approvalRequirement.status === 'PENDING') {
      throw {
        status: 400,
        code: 'PENDING_APPROVAL_BLOCKER',
        message: `Cannot transition directly to RESOLVED: Work item requires authorized sign-off. Use the Approve action.`,
      };
    }
  }

  // --- Reset to initial state (for clean test runs & demonstrations) ---
  public resetState() {
    this.nextWorkItemNumber = 1050;
    this.seed();
  }
}

export const appStore = new AppStore();
