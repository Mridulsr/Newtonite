/**
 * API Service for Newtonite Operations Command System
 */

import {
  User,
  Team,
  WorkItem,
  AuditEvent,
  WorkItemComment,
  OutboxTask,
  PaginatedResponse,
  WorkItemFilterParams,
} from '../shared/types.ts';

export class ApiError extends Error {
  status: number;
  code?: string;
  serverVersion?: number;
  serverItem?: WorkItem;
  fieldDiffs?: Record<string, { expected: any; currentOnServer: any }>;
  currentAssignee?: { id: string; name: string; email: string } | null;
  claimedAt?: string;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (data) {
      this.code = data.code;
      this.serverVersion = data.serverVersion;
      this.serverItem = data.serverItem;
      this.fieldDiffs = data.fieldDiffs;
      this.currentAssignee = data.currentAssignee;
      this.claimedAt = data.claimedAt;
    }
  }
}

// Helper to generate unique idempotency tokens
export function generateIdempotencyKey(actionPrefix: string): string {
  return `${actionPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

class ApiService {
  private currentUserId: string = 'user-alex';

  public setActorUser(userId: string) {
    this.currentUserId = userId;
  }

  public getActorUserId(): string {
    return this.currentUserId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': this.currentUserId,
      ...(options.headers as Record<string, string>),
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const isReplay = response.headers.get('Idempotent-Replay') === 'true';

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new ApiError(data?.error || data?.message || 'Request failed', response.status, data);
    }

    if (isReplay && data && typeof data === 'object') {
      data._isIdempotentReplay = true;
    }

    return data as T;
  }

  // Users & Teams
  public async getUsers(): Promise<User[]> {
    return this.request<User[]>('/api/users');
  }

  public async getTeams(): Promise<Team[]> {
    return this.request<Team[]>('/api/teams');
  }

  // Work Items
  public async getWorkItems(params: WorkItemFilterParams): Promise<PaginatedResponse<WorkItem>> {
    const query = new URLSearchParams();
    if (params.teamId && params.teamId !== 'all') query.set('teamId', params.teamId);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.severity && params.severity !== 'all') query.set('severity', params.severity);
    if (params.type && params.type !== 'all') query.set('type', params.type);
    if (params.assigneeId) query.set('assigneeId', params.assigneeId);
    if (params.search) query.set('search', params.search);
    if (params.unassigned) query.set('unassigned', 'true');
    if (params.pendingApproval) query.set('pendingApproval', 'true');
    if (params.slaBreached) query.set('slaBreached', 'true');
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    return this.request<PaginatedResponse<WorkItem>>(`/api/work-items?${query.toString()}`);
  }

  public async getWorkItem(id: string): Promise<WorkItem> {
    return this.request<WorkItem>(`/api/work-items/${id}`);
  }

  public async createWorkItem(payload: any, idempotencyKey?: string): Promise<WorkItem> {
    const key = idempotencyKey || generateIdempotencyKey('create');
    return this.request<WorkItem>('/api/work-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, key);
  }

  public async updateWorkItem(
    id: string,
    updates: Partial<WorkItem>,
    expectedVersion: number,
    idempotencyKey?: string
  ): Promise<WorkItem> {
    const key = idempotencyKey || generateIdempotencyKey('update');
    return this.request<WorkItem>(`/api/work-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, updates }),
    }, key);
  }

  public async claimWorkItem(id: string, forceReassign = false, idempotencyKey?: string): Promise<{ success: boolean; item: WorkItem; message: string }> {
    const key = idempotencyKey || generateIdempotencyKey('claim');
    return this.request<{ success: boolean; item: WorkItem; message: string }>(`/api/work-items/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ forceReassign }),
    }, key);
  }

  public async processApproval(
    id: string,
    action: 'APPROVE' | 'REJECT',
    notes: string,
    idempotencyKey?: string
  ): Promise<WorkItem> {
    const key = idempotencyKey || generateIdempotencyKey('approval');
    return this.request<WorkItem>(`/api/work-items/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }, key);
  }

  // Audit & Comments
  public async getAuditEvents(workItemId: string): Promise<AuditEvent[]> {
    return this.request<AuditEvent[]>(`/api/work-items/${workItemId}/audit`);
  }

  public async getComments(workItemId: string): Promise<WorkItemComment[]> {
    return this.request<WorkItemComment[]>(`/api/work-items/${workItemId}/comments`);
  }

  public async addComment(workItemId: string, content: string): Promise<WorkItemComment> {
    return this.request<WorkItemComment>(`/api/work-items/${workItemId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Heartbeat / Presence
  public async sendHeartbeat(workItemId: string): Promise<{ viewers: Array<{ userId: string; userName: string; lastSeen: string }> }> {
    return this.request(`/api/work-items/${workItemId}/heartbeat`, { method: 'POST' });
  }

  // Outbox Tasks
  public async getOutboxTasks(): Promise<OutboxTask[]> {
    return this.request<OutboxTask[]>('/api/outbox');
  }

  public async retryOutboxTask(id: string): Promise<OutboxTask> {
    return this.request<OutboxTask>(`/api/outbox/${id}/retry`, { method: 'POST' });
  }

  // Reset State
  public async resetState(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/store/reset', { method: 'POST' });
  }

  // Simulation endpoints
  public async runSimulateRaceCondition(params: { workItemId?: string; user1Id?: string; user2Id?: string }): Promise<any> {
    return this.request('/api/simulate/race-condition', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async runSimulateStaleUpdate(params: { workItemId?: string }): Promise<any> {
    return this.request('/api/simulate/stale-update', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async runSimulateIdempotency(): Promise<any> {
    return this.request('/api/simulate/idempotency', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
