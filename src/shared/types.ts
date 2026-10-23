/**
 * CampusConnect - Production Data Models, User Roles, and API Contracts
 * Enforces 5-category classification (with required custom title for 'Other'),
 * role-based access control (Student, Staff, Admin, Responder),
 * persistent student profile setup, two-step emergency response,
 * impact-based priority engine, recurring-issue clustering (10 in 2h),
 * proof of fix, and human-supervised AI triage workflows.
 */

export const TICKET_CATEGORIES = [
  'Plumbing',
  'Electricity',
  'Cleanliness',
  'Internet Connectivity',
  'Other'
] as const;

export type TicketCategory = typeof TICKET_CATEGORIES[number];

export const TICKET_STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Reopened'
] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];

export const DEPARTMENTS = [
  'Plumbing Maintenance Department',
  'Electrical Systems & Safety Division',
  'Campus Custodial & Sanitation Services',
  'IT & Network Infrastructure Team',
  'Campus Operations & General Maintenance',
  'Campus Safety & Emergency Security',
  'University Health & Medical Center'
] as const;

export type Department = typeof DEPARTMENTS[number];

export const CATEGORY_DEPARTMENT_ROUTING: Record<TicketCategory, Department> = {
  'Plumbing': 'Plumbing Maintenance Department',
  'Electricity': 'Electrical Systems & Safety Division',
  'Cleanliness': 'Campus Custodial & Sanitation Services',
  'Internet Connectivity': 'IT & Network Infrastructure Team',
  'Other': 'Campus Operations & General Maintenance'
};

/**
 * Valid workflow state transitions enforced by the backend
 */
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  'Submitted': ['Under Review', 'Assigned'],
  'Under Review': ['Assigned', 'In Progress', 'Resolved'],
  'Assigned': ['In Progress', 'Under Review'],
  'In Progress': ['Resolved', 'Assigned', 'Under Review'],
  'Resolved': ['Reopened', 'In Progress'],
  'Reopened': ['Under Review', 'Assigned', 'In Progress']
};

/**
 * User Roles and Authentication Models
 */
export type UserRole = 'student' | 'staff' | 'admin' | 'responder';

/**
 * Persistent Student Profile Setup
 */
export interface StudentProfile {
  userId: string;
  fullName: string;
  enrollmentNumber: string; // Student ID / enrollment number
  mobileNumber: string;
  collegeEmail: string;
  course: string;
  yearOrSemester: string;
  campus: string;
  hostelOrBlock?: string; // Optional for day scholars
  floor?: string;
  roomNumber?: string; // Optional where not applicable
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department; // For staff members and responders
  profile?: StudentProfile; // For students
  isActive: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface InternalStaffNote {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  ticketId: string;
  fromStatus?: TicketStatus;
  toStatus: TicketStatus;
  changedAt: string; // ISO 8601 string
  changedBy: string; // User name or role
  changedById?: string;
  notes?: string;
}

export interface Assignment {
  department: Department;
  assignedTo?: string; // Technician or officer name
  assignedToId?: string; // User ID if matched to staff account
  assignedAt: string;
  assignedBy: string;
  assignedById?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  notes?: string;
}

export interface AIAnalysis {
  suggestedCategory: TicketCategory;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceScore: number; // 0.0 to 1.0
  conciseSummary: string;
  recommendedDepartment: Department;
  departmentRoutingReason?: string;
  missingDetailsIdentified: string[];
  followUpQuestions: string[];
  imageObservations?: string;
  urgencyAssessment: 'Routine' | 'Moderate' | 'Urgent' | 'Safety Hazard';
  analyzedAt: string;
  isAiFallback?: boolean; // true if deterministic fallback heuristic was used
  detectedLanguage?: 'English' | 'Hindi' | 'Hinglish';
}

export interface DuplicateCandidate {
  ticketId: string;
  title: string;
  category: TicketCategory;
  location: string;
  status: TicketStatus;
  similarityScore: number; // 0.0 to 1.0
  matchReason: string;
}

export interface ProofOfFix {
  photoDataUri: string;
  summary: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedById: string;
}

export interface TicketBlocker {
  id: string;
  description: string;
  reportedAt: string;
  reportedBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface PriorityRecommendation {
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  reasons: string[];
  factors: {
    safetyRisk: boolean;
    urgencyScore: number;
    peopleAffectedEstimate: number;
    accessibilityImpact: boolean;
    criticalServiceDisruption: boolean;
    alternativesAvailable: boolean;
    isOverdue: boolean;
  };
  calculatedAt: string;
}

export interface PriorityOverride {
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  reason: string;
  overriddenBy: string;
  overriddenById: string;
  overriddenAt: string;
}

export interface Ticket {
  id: string; // e.g. "CC-1001"
  title: string;
  customProblemTitle?: string; // Required when category is 'Other'
  description: string;
  rawStudentInput: string;
  category: TicketCategory;
  categorySource: 'student' | 'ai_suggested' | 'staff_override';
  location: string;
  building: string;
  roomOrArea?: string;
  
  // Ownership and privacy
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentEnrollmentId?: string;
  studentMobile?: string;
  
  imageUrl?: string;
  imageDataUri?: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  
  aiAnalysis?: AIAnalysis;
  assignment?: Assignment;
  statusHistory: StatusHistoryEntry[];
  duplicateWarnings?: DuplicateCandidate[];
  duplicateReviewed?: boolean;
  duplicateReviewDecision?: 'confirmed' | 'dismissed';
  duplicateReviewNote?: string;
  duplicateReviewedBy?: string;
  
  studentFollowUpAnswers?: Record<string, string>;
  
  // Rules-based Priority Engine (Non-AI)
  priorityRecommendation?: PriorityRecommendation;
  priorityOverride?: PriorityOverride;
  
  // Proof of Fix (Required before 'Resolved')
  proofOfFix?: ProofOfFix;
  reopenReason?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  
  // Honest ETA & Blockers
  slaHoursTarget?: number;
  slaDeadline?: string;
  isOverdue?: boolean;
  blockers?: TicketBlocker[];
  
  // Shared Incident Linking (One Incident, Many Symptoms)
  parentIncidentId?: string;
  
  // Internal staff notes - STRIPPED from student responses by server
  internalNotes?: InternalStaffNote[];
}

/**
 * Public Ticket View (Safe for Student consumption)
 * Explicitly excludes private internal staff notes
 */
export type StudentTicketView = Omit<Ticket, 'internalNotes'>;

/**
 * Emergency Incident Models (Strictly 2 Primary Steps)
 */
export interface EmergencyNotificationAttempt {
  id: string;
  channel: 'Security Dispatch' | 'Medical Health Desk' | 'Campus Responder SMS';
  recipient: string;
  status: 'Sent' | 'Delivered' | 'Failed' | 'Acknowledged';
  sentAt: string;
  deliveredAt?: string;
  failureReason?: string;
}

export interface EmergencyTimelineEntry {
  timestamp: string;
  status: string;
  actor: string;
  details: string;
}

export interface EmergencyIncident {
  id: string; // e.g. "EMG-1001"
  studentId: string;
  studentName: string;
  studentEnrollmentId?: string;
  mobileNumber: string;
  campus: string;
  building: string;
  floor?: string;
  room?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
  emergencyType: 'medical' | 'security' | 'general';
  description?: string;
  status:
    | 'Sending'
    | 'Alert sent'
    | 'Awaiting acknowledgement'
    | 'Acknowledged'
    | 'Responding'
    | 'Escalated'
    | 'Resolved'
    | 'Delivery failed';
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  respondingAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  closureNotes?: string;
  assignedResponderZone?: string;
  escalatedAt?: string;
  escalationReason?: string;
  notificationAttempts: EmergencyNotificationAttempt[];
  timeline: EmergencyTimelineEntry[];
}

/**
 * Recurring-Issue Clustering (>= 10 complaints in rolling 2 hours)
 */
export interface IncidentCluster {
  id: string; // e.g. "CLUSTER-101"
  title: string;
  category: TicketCategory;
  building: string;
  area?: string;
  ticketIds: string[];
  ticketCount: number;
  firstReportTime: string;
  latestReportTime: string;
  status: 'Active' | 'Investigating' | 'Resolved' | 'Dismissed';
  priority: 'High';
  priorityReason: string;
  auditLog: {
    action: string;
    timestamp: string;
    performedBy: string;
    note?: string;
  }[];
}

/**
 * Repeat-Offender Asset Detector Model
 */
export interface RepeatOffenderAsset {
  assetId: string; // e.g. "ELEVATOR-SEC-01", "AC-QUAD-101"
  assetName: string;
  building: string;
  roomOrArea: string;
  category: TicketCategory;
  recurrenceCount30Days: number;
  lastIncidentDate: string;
  unverifiedRootCauseHypothesis: string;
  historicalTicketIds: string[];
}

/**
 * Classroom / Area Readiness Score Model
 */
export interface ClassroomReadiness {
  roomId: string;
  building: string;
  roomNumber: string;
  status: 'Verified working' | 'Known issue' | 'Unknown/Stale';
  score: number; // 0 - 100
  activeIssueCount: number;
  lastVerifiedAt: string;
  checks: {
    equipment: string;
    status: 'Operational' | 'Degraded' | 'Offline' | 'Stale';
    verifiedAt: string;
    notes?: string;
  }[];
}

/**
 * Verified Instant Workaround
 */
export interface FacilityWorkaround {
  disruptedFacility: string;
  disruptedLocation: string;
  category: TicketCategory;
  suggestedAlternative: string;
  alternativeLocation: string;
  walkingMinutes: number;
  isVerifiedOperational: boolean;
  verificationSource: string;
  verificationTimestamp: string;
}

/**
 * Campus Waste Detector Item
 */
export interface CampusWasteAlert {
  id: string;
  type: 'Water Waste (Continuous Leak)' | 'Energy Waste (HVAC/Lighting Active in Empty Space)';
  building: string;
  location: string;
  ticketId: string;
  durationHoursEstimate: number;
  reportedAt: string;
  recommendedAction: string;
}

/**
 * Campus X-Ray Hotspot Stat
 */
export interface CampusXRayHotspot {
  building: string;
  activeTicketCount: number;
  resolvedTicketCount: number;
  topCategory: TicketCategory;
  highPriorityCount: number;
  averageResolutionHours: number;
}

/**
 * API Request & Response Contracts
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  enrollmentNumber: string;
  mobileNumber: string;
  collegeEmail?: string;
  course: string;
  yearOrSemester: string;
  campus: string;
  hostelOrBlock?: string;
  floor?: string;
  roomNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface AnalyzeComplaintRequest {
  description: string;
  location?: string;
  building?: string;
  imageBase64?: string; // optional image payload
  mimeType?: string;
}

export interface AnalyzeComplaintResponse {
  success: boolean;
  analysis: AIAnalysis;
  duplicateCandidates: DuplicateCandidate[];
  message?: string;
}

export interface SubmitComplaintRequest {
  description: string;
  location: string;
  building: string;
  roomOrArea?: string;
  category: TicketCategory;
  customProblemTitle?: string;
  categorySource?: 'student' | 'ai_suggested';
  studentName?: string;
  studentEmail?: string;
  imageBase64?: string;
  mimeType?: string;
  aiAnalysis?: AIAnalysis;
  studentFollowUpAnswers?: Record<string, string>;
}

export interface SubmitComplaintResponse {
  success: boolean;
  ticket?: Ticket;
  error?: string;
  duplicateWarnings?: DuplicateCandidate[];
}

export interface SubmitEmergencyRequest {
  emergencyType: 'medical' | 'security' | 'general';
  building?: string;
  floor?: string;
  room?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
  notes?: string;
}

export interface SubmitProofOfFixRequest {
  photoDataUri: string;
  summary: string;
}

export interface ReopenTicketRequest {
  reason: string;
}

export interface OverridePriorityRequest {
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  reason: string;
}

export interface AddBlockerRequest {
  description: string;
}

export interface TicketListResponse {
  success: boolean;
  tickets: Ticket[] | StudentTicketView[];
  total: number;
  stats: {
    total: number;
    submitted: number;
    underReview: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    reopened?: number;
    byCategory: Record<TicketCategory, number>;
  };
}

export interface TicketDetailResponse {
  success: boolean;
  ticket?: Ticket | StudentTicketView;
  error?: string;
}

export interface AssignTicketRequest {
  department: Department;
  assignedTo?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  notes?: string;
}

export interface UpdateTicketStatusRequest {
  status: TicketStatus;
  notes?: string;
}

export interface AddInternalNoteRequest {
  content: string;
}

export interface ReviewDuplicateRequest {
  action: 'confirm' | 'dismiss';
  duplicateTicketId?: string;
  note?: string;
}

export interface TicketHistoryResponse {
  success: boolean;
  ticketId: string;
  history: StatusHistoryEntry[];
}

export interface AdminCreateStaffRequest {
  name: string;
  email: string;
  password: string;
  role: 'staff' | 'admin' | 'responder';
  department: Department;
}

export interface AdminUpdateStaffRequest {
  role?: 'staff' | 'admin' | 'responder';
  department?: Department;
  isActive?: boolean;
}
