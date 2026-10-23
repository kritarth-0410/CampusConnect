/**
 * CampusConnect - Frontend API Client
 * Manages authorization headers, session tokens, error parsing, and typed endpoint methods.
 */

import {
  AdminCreateStaffRequest,
  AdminUpdateStaffRequest,
  AnalyzeComplaintRequest,
  AnalyzeComplaintResponse,
  AssignTicketRequest,
  AuthResponse,
  CampusWasteAlert,
  CampusXRayHotspot,
  ClassroomReadiness,
  EmergencyIncident,
  FacilityWorkaround,
  IncidentCluster,
  LoginRequest,
  RegisterRequest,
  RepeatOffenderAsset,
  ReviewDuplicateRequest,
  StudentProfile,
  StudentTicketView,
  SubmitComplaintRequest,
  SubmitComplaintResponse,
  SubmitEmergencyRequest,
  SubmitProofOfFixRequest,
  Ticket,
  TicketDetailResponse,
  TicketHistoryResponse,
  TicketListResponse,
  UpdateProfileRequest,
  UpdateTicketStatusRequest,
  User
} from '../shared/types.js';

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Restore token from localStorage if available
    try {
      this.token = localStorage.getItem('campusconnect_token');
    } catch {
      // In SSR or sandboxed environment
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('campusconnect_token', token);
      } else {
        localStorage.removeItem('campusconnect_token');
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errorMsg = `Request failed with status ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch {
        // Fallback
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  public async login(creds: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds)
    });
    if (res.success && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async register(payload: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async getCurrentUser(): Promise<{ success: boolean; user?: User }> {
    return this.request<{ success: boolean; user?: User }>('/api/auth/me');
  }

  public async logout(): Promise<{ success: boolean }> {
    try {
      await this.request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue client cleanup even if network fails
    }
    this.setToken(null);
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // STUDENT PROFILE SETUP & PERSISTENCE
  // --------------------------------------------------------------------------

  public async getStudentProfile(): Promise<{ success: boolean; profile?: StudentProfile; error?: string }> {
    return this.request('/api/profile');
  }

  public async updateStudentProfile(
    payload: Partial<StudentProfile>
  ): Promise<{ success: boolean; profile?: StudentProfile; error?: string; message?: string }> {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // --------------------------------------------------------------------------
  // EMERGENCY REPORTING (Strictly 2 Primary Steps)
  // --------------------------------------------------------------------------

  public async submitEmergency(payload: SubmitEmergencyRequest): Promise<{
    success: boolean;
    incident?: EmergencyIncident;
    isDuplicateSuppressed?: boolean;
    message?: string;
    error?: string;
  }> {
    return this.request('/api/emergency/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getEmergencyIncidents(): Promise<{ success: boolean; incidents: EmergencyIncident[]; total: number }> {
    return this.request('/api/emergency/incidents');
  }

  public async getEmergencyIncidentById(id: string): Promise<{ success: boolean; incident?: EmergencyIncident }> {
    return this.request(`/api/emergency/incidents/${encodeURIComponent(id)}`);
  }

  public async acknowledgeEmergency(
    id: string,
    notes?: string
  ): Promise<{ success: boolean; incident?: EmergencyIncident; message?: string }> {
    return this.request(`/api/emergency/incidents/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  }

  public async updateEmergencyStatus(
    id: string,
    status: 'Responding' | 'Escalated' | 'Resolved',
    notes?: string
  ): Promise<{ success: boolean; incident?: EmergencyIncident; message?: string }> {
    return this.request(`/api/emergency/incidents/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes })
    });
  }

  // --------------------------------------------------------------------------
  // AI TRIAGE (Strict Complaint-Intake Scope Only)
  // --------------------------------------------------------------------------

  public async analyzeComplaint(payload: AnalyzeComplaintRequest): Promise<AnalyzeComplaintResponse> {
    return this.request<AnalyzeComplaintResponse>('/api/complaints/analyze', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // --------------------------------------------------------------------------
  // TICKETS
  // --------------------------------------------------------------------------

  public async submitComplaint(payload: SubmitComplaintRequest): Promise<SubmitComplaintResponse> {
    return this.request<SubmitComplaintResponse>('/api/complaints/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getTickets(params?: {
    category?: string;
    status?: string;
    query?: string;
    building?: string;
    department?: string;
  }): Promise<TicketListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') searchParams.set('category', params.category);
    if (params?.status && params.status !== 'ALL') searchParams.set('status', params.status);
    if (params?.department && params.department !== 'ALL') searchParams.set('department', params.department);
    if (params?.building && params.building !== 'ALL') searchParams.set('building', params.building);
    if (params?.query) searchParams.set('query', params.query);

    const qs = searchParams.toString();
    return this.request<TicketListResponse>(`/api/tickets${qs ? `?${qs}` : ''}`);
  }

  public async getTicketById(id: string): Promise<TicketDetailResponse> {
    return this.request<TicketDetailResponse>(`/api/tickets/${encodeURIComponent(id)}`);
  }

  public async assignTicket(
    id: string,
    payload: AssignTicketRequest
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async submitProofOfFix(
    id: string,
    payload: SubmitProofOfFixRequest
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/proof-of-fix`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateStatus(
    id: string,
    payload: UpdateTicketStatusRequest
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async reopenTicket(
    id: string,
    reason: string
  ): Promise<{ success: boolean; ticket?: Ticket; message?: string; error?: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  public async overridePriority(
    id: string,
    priority: 'Low' | 'Medium' | 'High' | 'Emergency',
    reason: string
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/priority-override`, {
      method: 'POST',
      body: JSON.stringify({ priority, reason })
    });
  }

  public async addBlocker(
    id: string,
    description: string
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/blockers`, {
      method: 'POST',
      body: JSON.stringify({ description })
    });
  }

  public async addInternalNote(
    id: string,
    content: string
  ): Promise<{ success: boolean; note: any; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  public async reviewDuplicate(
    id: string,
    payload: ReviewDuplicateRequest
  ): Promise<{ success: boolean; ticket: Ticket; message: string }> {
    return this.request(`/api/tickets/${encodeURIComponent(id)}/duplicate-review`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getTicketHistory(id: string): Promise<TicketHistoryResponse> {
    return this.request<TicketHistoryResponse>(`/api/tickets/${encodeURIComponent(id)}/history`);
  }

  // --------------------------------------------------------------------------
  // CLUSTERING & ADVANCED OPERATIONAL APIS
  // --------------------------------------------------------------------------

  public async getClusters(): Promise<{ success: boolean; clusters: IncidentCluster[]; total: number }> {
    return this.request('/api/clusters');
  }

  public async reviewCluster(
    clusterId: string,
    action: 'dismiss' | 'resolve' | 'unlink',
    note?: string,
    ticketIdToUnlink?: string
  ): Promise<{ success: boolean; cluster: IncidentCluster }> {
    return this.request(`/api/clusters/${encodeURIComponent(clusterId)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, note, ticketIdToUnlink })
    });
  }

  public async getRepeatOffenders(): Promise<{ success: boolean; repeatOffenders: RepeatOffenderAsset[] }> {
    return this.request('/api/assets/repeat-offenders');
  }

  public async getClassroomReadiness(): Promise<{ success: boolean; readiness: ClassroomReadiness[] }> {
    return this.request('/api/classrooms/readiness');
  }

  public async getWorkarounds(): Promise<{ success: boolean; workarounds: FacilityWorkaround[] }> {
    return this.request('/api/facilities/workarounds');
  }

  public async getWasteAlerts(): Promise<{ success: boolean; wasteAlerts: CampusWasteAlert[] }> {
    return this.request('/api/campus/waste');
  }

  public async getCampusXRay(): Promise<{ success: boolean; hotspots: CampusXRayHotspot[] }> {
    return this.request('/api/campus/xray');
  }

  // --------------------------------------------------------------------------
  // ADMINISTRATOR
  // --------------------------------------------------------------------------

  public async getAdminStaff(): Promise<{ success: boolean; staff: User[] }> {
    return this.request<{ success: boolean; staff: User[] }>('/api/admin/staff');
  }

  public async createStaffMember(payload: AdminCreateStaffRequest): Promise<{ success: boolean; staff: User }> {
    return this.request<{ success: boolean; staff: User }>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateStaffMember(id: string, payload: AdminUpdateStaffRequest): Promise<{ success: boolean; staff: User }> {
    return this.request<{ success: boolean; staff: User }>(`/api/admin/staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  public async getAdminMetrics(): Promise<{ success: boolean; metrics: any }> {
    return this.request<{ success: boolean; metrics: any }>('/api/admin/metrics');
  }

  public async checkHealth(): Promise<any> {
    return this.request('/api/health');
  }
}

export const apiClient = new ApiClient();
