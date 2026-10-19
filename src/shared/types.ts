/**
 * Shared Type Definitions for Newtonite Operations Command System
 */

export type GlobalRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export type TeamRole = 'TEAM_LEAD' | 'APPROVER' | 'OPERATOR' | 'OBSERVER';

export interface TeamMembership {
  teamId: string;
  role: TeamRole;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  title: string;
  department: string;
  globalRole: GlobalRole;
  teamMemberships: TeamMembership[];
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  defaultApproverRole: TeamRole;
  leadUserId: string;
  color: string;
}

export type WorkItemType =
  | 'INCIDENT'
  | 'PAYMENT_INVESTIGATION'
  | 'CUSTOMER_ESCALATION'
  | 'ENGINEERING_BUG'
  | 'COMPLIANCE_REQUEST'
  | 'OPERATIONAL_TASK';

export type WorkItemStatus =
  | 'TRIAGE'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'CLOSED';

export type WorkItemSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ApprovalRequirement {
  requiredRole: 'APPROVER' | 'TEAM_LEAD' | 'ADMIN';
  requiredTeamId?: string;
  status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  thresholdAmount?: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  teamId: string;
  type: WorkItemType;
  severity: WorkItemSeverity;
  status: WorkItemStatus;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number; // Optimistic Concurrency Control
  slaDeadline: string;
  slaBreached: boolean;
  approvalRequirement?: ApprovalRequirement;
  tags: string[];
  metadata?: Record<string, any>;
  commentCount?: number;
}

export type AuditActionType =
  | 'CREATED'
  | 'CLAIMED'
  | 'REASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'FIELD_UPDATED'
  | 'COMMENT_ADDED'
  | 'SLA_BREACH_DETECTED';

export interface AuditFieldDiff {
  before: any;
  after: any;
}

export interface AuditEvent {
  id: string;
  workItemId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actionType: AuditActionType;
  summary: string;
  diff?: Record<string, AuditFieldDiff>;
  timestamp: string;
}

export interface WorkItemComment {
  id: string;
  workItemId: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  createdAt: string;
}

export type OutboxTaskType =
  | 'DISPATCH_WEBHOOK'
  | 'CHECK_SLA_BREACH'
  | 'AUDIT_ENRICHMENT'
  | 'COMPLIANCE_REPORT_SYNC'
  | 'NOTIFY_TEAM_LEAD';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OutboxTask {
  id: string;
  workItemId: string;
  taskType: OutboxTaskType;
  payload: Record<string, any>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  scheduledAt: string;
  processedAt?: string;
}

export interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  statusCode: number;
  responseBody: any;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WorkItemFilterParams {
  teamId?: string;
  status?: string;
  severity?: string;
  assigneeId?: string;
  search?: string;
  type?: string;
  needsAttention?: boolean;
  unassigned?: boolean;
  pendingApproval?: boolean;
  slaBreached?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'severity' | 'slaDeadline';
  sortOrder?: 'asc' | 'desc';
}

export interface ActiveViewer {
  userId: string;
  userName: string;
  lastSeen: string;
}

export interface ConcurrencySimulationResult {
  scenario: string;
  winnerUserId: string;
  loserUserId: string;
  winnerStatus: number;
  loserStatus: number;
  winnerBody: any;
  loserBody: any;
  explanation: string;
}
