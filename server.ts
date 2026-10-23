/**
 * CampusConnect - Production Full-Stack Server
 * Features:
 * - Real role-based authentication (Student, Staff, Admin, Responder)
 * - Persistent Student Profile Setup with server-side ownership validation
 * - Emergency Reporting (Strictly Two Primary Steps) with responder dispatch & acknowledgement
 * - Server-side authorization on every protected route (no client-side bypass)
 * - Insecure Direct Object Reference (IDOR) prevention
 * - Internal staff notes separation (stripped from student API responses)
 * - Validated workflow state transitions with mandatory Proof of Fix on resolve
 * - Reopen ticket mechanism for reporting students
 * - Impact-Based Priority Engine (Non-AI)
 * - Recurring-Issue Clustering (10 in rolling 2 hours)
 * - Repeat-Offender Asset Detector & Classroom Readiness scoring
 * - Verified Instant Workarounds, Campus Waste Detector & Campus X-Ray Hotspots
 * - Server-side Gemini 3.8 Flash AI integration (EXCLUSIVELY for complaint intake)
 * - Host: 0.0.0.0, Port: 3000
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  DEPARTMENTS,
  TicketCategory,
  TicketStatus,
  Department,
  User,
  VALID_STATUS_TRANSITIONS
} from './src/shared/types.js';
import {
  analyzeComplaintWithGemini,
  detectDuplicateCandidates
} from './src/server/geminiService.js';
import { ticketRepository } from './src/server/ticketStore.js';
import { userStore } from './src/server/userStore.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

async function createServer() {
  const app = express();

  // Middleware for JSON bodies (supports up to 6MB for base64 photo attachments)
  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true, limit: '6mb' }));

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Authentication Middleware: Extracts Bearer token
  const authenticateToken = (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const user = userStore.validateSession(token);
      if (user) {
        req.user = user;
      }
    }
    next();
  };

  app.use(authenticateToken);

  // Guard: Requires any authenticated user
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to access this resource.'
      });
    }
    next();
  };

  // Guard: Requires staff or admin role
  const requireStaff = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: This action requires campus facilities staff authorization.'
      });
    }
    next();
  };

  // Guard: Requires emergency responder, staff, or admin role
  const requireResponderOrStaff = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.role !== 'responder' && req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Requires designated campus responder or staff privileges.'
      });
    }
    next();
  };

  // Guard: Requires admin role
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Administrator privileges required.'
      });
    }
    next();
  };

  // --------------------------------------------------------------------------
  // AUTHENTICATION ROUTES
  // --------------------------------------------------------------------------

  // Sign In (Students, Staff, Admin, Responders)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const result = userStore.authenticate(email, password);
      if (!result) {
        return res.status(401).json({
          success: false,
          error: 'Invalid campus credentials or inactive account.'
        });
      }

      return res.json({
        success: true,
        user: result.user,
        token: result.token
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Student Registration
  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: 'Full name is required' });
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid campus email is required' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      const result = userStore.registerStudent(name, email, password);
      return res.status(201).json({
        success: true,
        user: result.user,
        token: result.token
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Get Current Authenticated Profile
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    return res.json({
      success: true,
      user: req.user
    });
  });

  // Sign Out
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      userStore.logout(token);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  // --------------------------------------------------------------------------
  // STUDENT PROFILE SETUP & PERSISTENCE (Server-Enforced Ownership)
  // --------------------------------------------------------------------------

  // Get current student's saved profile
  app.get('/api/profile', requireAuth, (req: Request, res: Response) => {
    if (req.user!.role !== 'student') {
      return res.status(400).json({ success: false, error: 'Profile setup is dedicated to student accounts' });
    }

    const profile = userStore.getStudentProfile(req.user!.id);
    return res.json({
      success: true,
      profile
    });
  });

  // Save/Update student profile (Validated & Persisted)
  app.put('/api/profile', requireAuth, (req: Request, res: Response) => {
    if (req.user!.role !== 'student') {
      return res.status(400).json({ success: false, error: 'Only students can update a student profile' });
    }

    const result = userStore.updateStudentProfile(req.user!.id, req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      profile: result.profile,
      message: 'Student profile saved and verified successfully'
    });
  });

  // --------------------------------------------------------------------------
  // EMERGENCY INCIDENT REPORTING (Strictly Two Primary Steps)
  // --------------------------------------------------------------------------

  // Step 2: Confirm Emergency Alert (Uses reporting student's own saved profile)
  app.post('/api/emergency/submit', requireAuth, (req: Request, res: Response) => {
    try {
      const { emergencyType, building, floor, room, gps, notes } = req.body;

      const validTypes = ['medical', 'security', 'general'];
      const type = validTypes.includes(emergencyType) ? emergencyType : 'general';

      const result = ticketRepository.createEmergencyIncident({
        studentUser: req.user!,
        emergencyType: type,
        building,
        floor,
        room,
        gps,
        notes
      });

      return res.status(201).json({
        success: true,
        incident: result.incident,
        isDuplicateSuppressed: result.isDuplicateSuppressed || false,
        message: result.isDuplicateSuppressed
          ? 'Emergency alert is already active; notifications currently en route.'
          : 'Emergency incident created; responders and dispatch notified.'
      });
    } catch (err: any) {
      console.error('[API /api/emergency/submit Error]', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to submit emergency alert' });
    }
  });

  // List Emergency Incidents (Role scoped: Student sees own; Responders/Staff/Admin see all)
  app.get('/api/emergency/incidents', requireAuth, (req: Request, res: Response) => {
    const incidents = ticketRepository.getEmergencyIncidentsForUser(req.user!);
    return res.json({
      success: true,
      incidents,
      total: incidents.length
    });
  });

  // Get Emergency Incident by ID
  app.get('/api/emergency/incidents/:id', requireAuth, (req: Request, res: Response) => {
    const incident = ticketRepository.getEmergencyIncidentById(req.params.id, req.user!);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Emergency incident not found or access denied.' });
    }
    return res.json({
      success: true,
      incident
    });
  });

  // Acknowledge Emergency (Responders, Staff, Admin)
  app.post('/api/emergency/incidents/:id/acknowledge', requireResponderOrStaff, (req: Request, res: Response) => {
    const { notes } = req.body;
    const result = ticketRepository.acknowledgeEmergency(req.params.id, req.user!, notes);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      incident: result.incident,
      message: 'Emergency incident acknowledged. Responder marked active.'
    });
  });

  // Update Emergency Status (Responders, Staff, Admin)
  app.post('/api/emergency/incidents/:id/status', requireResponderOrStaff, (req: Request, res: Response) => {
    const { status, notes } = req.body;
    if (!['Responding', 'Escalated', 'Resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "Responding", "Escalated", or "Resolved"'
      });
    }

    const result = ticketRepository.updateEmergencyStatus(req.params.id, status, req.user!, notes);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      incident: result.incident,
      message: `Emergency status updated to ${status}`
    });
  });

  // --------------------------------------------------------------------------
  // HEALTH & DIAGNOSTICS ROUTES
  // --------------------------------------------------------------------------

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'CampusConnect Production Server',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      storage: ticketRepository.getStorageStatus()
    });
  });

  app.get('/api/storage/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      storage: ticketRepository.getStorageStatus()
    });
  });

  // --------------------------------------------------------------------------
  // AI COMPLAINT TRIAGE ROUTES (STRICT COMPLAINT-INTAKE WORKFLOW ONLY)
  // --------------------------------------------------------------------------

  app.post('/api/complaints/analyze', async (req: Request, res: Response) => {
    try {
      const { description, location, building, imageBase64, mimeType } = req.body;

      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Complaint description is required for triage analysis.'
        });
      }

      // Validate image format if provided
      if (imageBase64) {
        if (!mimeType || !mimeType.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            error: 'Attached file must be a valid image format (JPEG, PNG, WebP).'
          });
        }
      }

      // Run server-side Gemini AI analysis (or deterministic fallback)
      const analysis = await analyzeComplaintWithGemini({
        description: description.trim(),
        location: location ? String(location).trim() : undefined,
        building: building ? String(building).trim() : undefined,
        imageBase64,
        mimeType
      });

      // Scan existing complaints for duplicates
      const allTickets = ticketRepository.getTicketsForUser({
        id: 'system',
        name: 'System',
        email: 'system@campus.edu',
        role: 'admin',
        isActive: true,
        createdAt: ''
      }) as any[];

      const duplicateCandidates = detectDuplicateCandidates(
        {
          description,
          category: analysis.suggestedCategory,
          location,
          building
        },
        allTickets
      );

      return res.json({
        success: true,
        analysis,
        duplicateCandidates
      });
    } catch (error: any) {
      console.error('[API /api/complaints/analyze Error]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal error during complaint analysis'
      });
    }
  });

  // --------------------------------------------------------------------------
  // TICKET CRUD & WORKFLOW ROUTES (SERVER-ENFORCED ACCESS)
  // --------------------------------------------------------------------------

  // Submit Complaint (Requires student/authenticated user)
  app.post('/api/complaints/submit', requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        description,
        location,
        building,
        roomOrArea,
        category,
        customProblemTitle,
        categorySource,
        imageBase64,
        mimeType,
        aiAnalysis,
        studentFollowUpAnswers
      } = req.body;

      if (!description || !description.trim()) {
        return res.status(400).json({ success: false, error: 'Description is required' });
      }

      if (!building || !building.trim()) {
        return res.status(400).json({ success: false, error: 'Campus building is required' });
      }

      if (!location || !location.trim()) {
        return res.status(400).json({ success: false, error: 'Specific location or room is required' });
      }

      // Validation of the 5 allowed categories
      if (!TICKET_CATEGORIES.includes(category as TicketCategory)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: "${category}". Must be one of: ${TICKET_CATEGORIES.join(', ')}`
        });
      }

      // If Category is 'Other', a custom Problem Title is MANDATORY
      if (category === 'Other') {
        if (!customProblemTitle || !customProblemTitle.trim()) {
          return res.status(400).json({
            success: false,
            error: 'When category is "Other", a custom Problem Title is required.'
          });
        }
      }

      // Image validation
      if (imageBase64) {
        if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          return res.status(400).json({
            success: false,
            error: 'Photo must be JPEG, PNG, or WebP format.'
          });
        }
      }

      const allTickets = ticketRepository.getTicketsForUser({
        id: 'system',
        name: 'System',
        email: 'system@campus.edu',
        role: 'admin',
        isActive: true,
        createdAt: ''
      }) as any[];

      const duplicateWarnings = detectDuplicateCandidates(
        { description, category, location, building },
        allTickets
      );

      const ticket = ticketRepository.createTicket({
        description: description.trim(),
        location: location.trim(),
        building: building.trim(),
        roomOrArea: roomOrArea ? roomOrArea.trim() : undefined,
        category,
        customProblemTitle: customProblemTitle ? customProblemTitle.trim() : undefined,
        categorySource: categorySource || 'student',
        studentUser: req.user!,
        imageBase64,
        mimeType,
        aiAnalysis,
        studentFollowUpAnswers,
        duplicateWarnings
      });

      return res.status(201).json({
        success: true,
        ticket,
        duplicateWarnings
      });
    } catch (error: any) {
      console.error('[API /api/complaints/submit Error]', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit complaint'
      });
    }
  });

  // List Tickets (Scoped by role: Students only see their own!)
  app.get('/api/tickets', requireAuth, (req: Request, res: Response) => {
    try {
      const { category, status, query, building, department } = req.query;

      const tickets = ticketRepository.getTicketsForUser(req.user!, {
        category: typeof category === 'string' ? category : undefined,
        status: typeof status === 'string' ? status : undefined,
        building: typeof building === 'string' ? building : undefined,
        department: typeof department === 'string' ? department : undefined,
        query: typeof query === 'string' ? query : undefined
      });

      const stats = ticketRepository.getStatsForUser(req.user!);

      return res.json({
        success: true,
        tickets,
        total: tickets.length,
        stats
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Ticket Lookup by ID (IDOR Protected: Students cannot view other students' tickets)
  app.get('/api/tickets/:id', requireAuth, (req: Request, res: Response) => {
    const rawId = req.params.id;
    let cleanId = rawId.trim().toUpperCase();
    if (/^\d+$/.test(cleanId)) {
      cleanId = `CC-${cleanId}`;
    }

    const ticket = ticketRepository.getByIdForUser(cleanId, req.user!);
    if (!ticket) {
      // IDOR check
      const rawExists = ticketRepository.getRawById(cleanId);
      if (rawExists && req.user!.role === 'student' && rawExists.studentId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to view another student\'s complaint record.'
        });
      }

      return res.status(404).json({
        success: false,
        error: `No ticket found with ID "${rawId}".`
      });
    }

    return res.json({
      success: true,
      ticket
    });
  });

  // Assign Ticket (Staff / Admin only)
  app.post('/api/tickets/:id/assign', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { department, assignedTo, priority, notes } = req.body;

    if (!department || !DEPARTMENTS.includes(department as Department)) {
      return res.status(400).json({
        success: false,
        error: `Department must be one of: ${DEPARTMENTS.join(', ')}`
      });
    }

    const validPriorities = ['Low', 'Medium', 'High', 'Emergency'];
    const p = validPriorities.includes(priority) ? priority : 'Medium';

    const ticket = ticketRepository.assignTicket(
      id,
      department as Department,
      assignedTo,
      p,
      notes,
      req.user!
    );

    if (!ticket) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found` });
    }

    return res.json({
      success: true,
      ticket,
      message: `Ticket ${id} assigned to ${department}`
    });
  });

  // Submit Proof of Fix (Staff / Admin only)
  app.post('/api/tickets/:id/proof-of-fix', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { photoDataUri, summary } = req.body;

    const result = ticketRepository.submitProofOfFix(id, photoDataUri, summary, req.user!);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      ticket: result.ticket,
      message: 'Proof of Fix verified and recorded.'
    });
  });

  // Update Status (Staff / Admin only with state machine validation & mandatory Proof of Fix)
  app.post('/api/tickets/:id/status', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !TICKET_STATUSES.includes(status as TicketStatus)) {
      return res.status(400).json({
        success: false,
        error: `Status must be exactly one of: ${TICKET_STATUSES.join(', ')}`
      });
    }

    const result = ticketRepository.updateStatus(
      id,
      status as TicketStatus,
      notes,
      req.user!
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      ticket: result.ticket,
      message: `Status updated to ${status}`
    });
  });

  // Student Reopen Ticket (Ownership verified)
  app.post('/api/tickets/:id/reopen', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const result = ticketRepository.reopenTicket(id, req.user!, reason);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      ticket: result.ticket,
      message: 'Complaint reopened and flagged for staff review.'
    });
  });

  // Override Priority (Staff / Admin only with audit log)
  app.post('/api/tickets/:id/priority-override', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { priority, reason } = req.body;

    if (!['Low', 'Medium', 'High', 'Emergency'].includes(priority)) {
      return res.status(400).json({ success: false, error: 'Invalid priority level' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Staff audit reason is required for priority override' });
    }

    const updated = ticketRepository.overridePriority(id, priority, reason, req.user!);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found` });
    }

    return res.json({
      success: true,
      ticket: updated,
      message: `Priority overridden to ${priority}`
    });
  });

  // Add Blocker to Ticket (Staff / Admin only)
  app.post('/api/tickets/:id/blockers', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, error: 'Blocker description is required' });
    }

    const updated = ticketRepository.addBlocker(id, description, req.user!);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found` });
    }

    return res.json({
      success: true,
      ticket: updated,
      message: 'Blocker recorded on ticket.'
    });
  });

  // Add Internal Staff Note (Staff / Admin only - NOT visible to students)
  app.post('/api/tickets/:id/notes', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Note content cannot be empty' });
    }

    const note = ticketRepository.addInternalNote(id, req.user!, content);
    if (!note) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found` });
    }

    return res.status(201).json({
      success: true,
      note,
      message: 'Internal note added successfully'
    });
  });

  // Review Duplicate Suggestion (Staff / Admin only)
  app.post('/api/tickets/:id/duplicate-review', requireStaff, (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, note } = req.body;

    if (action !== 'confirm' && action !== 'dismiss') {
      return res.status(400).json({
        success: false,
        error: 'Action must be "confirm" or "dismiss"'
      });
    }

    const updated = ticketRepository.reviewDuplicate(
      id,
      action === 'confirm' ? 'confirmed' : 'dismissed',
      req.user!,
      note
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found` });
    }

    return res.json({
      success: true,
      ticket: updated,
      message: `Duplicate warning ${action === 'confirm' ? 'confirmed' : 'dismissed'} by staff.`
    });
  });

  // Ticket Audit History (Protected)
  app.get('/api/tickets/:id/history', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const ticket = ticketRepository.getByIdForUser(id, req.user!);

    if (!ticket) {
      return res.status(404).json({ success: false, error: `Ticket ${id} not found or access denied.` });
    }

    return res.json({
      success: true,
      ticketId: ticket.id,
      history: ticket.statusHistory
    });
  });

  // --------------------------------------------------------------------------
  // ADVANCED CAMPUS INTELLIGENCE & OPERATIONAL ENDPOINTS
  // --------------------------------------------------------------------------

  // Recurring-Issue Clusters (>= 10 complaints in rolling 2 hours)
  app.get('/api/clusters', requireStaff, (_req: Request, res: Response) => {
    const clusters = ticketRepository.getClusters();
    return res.json({
      success: true,
      clusters,
      total: clusters.length
    });
  });

  app.post('/api/clusters/:id/action', requireStaff, (req: Request, res: Response) => {
    const { action, note, ticketIdToUnlink } = req.body;
    if (!['dismiss', 'resolve', 'unlink'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid cluster review action' });
    }

    const updated = ticketRepository.reviewCluster(
      req.params.id,
      action,
      req.user!,
      note,
      ticketIdToUnlink
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Cluster not found' });
    }

    return res.json({ success: true, cluster: updated });
  });

  // Repeat-Offender Asset Detector
  app.get('/api/assets/repeat-offenders', requireStaff, (_req: Request, res: Response) => {
    const repeatOffenders = ticketRepository.getRepeatOffenders();
    return res.json({
      success: true,
      repeatOffenders
    });
  });

  // Classroom / Area Readiness Scores
  app.get('/api/classrooms/readiness', requireAuth, (_req: Request, res: Response) => {
    const readiness = ticketRepository.getClassroomReadiness();
    return res.json({
      success: true,
      readiness
    });
  });

  // Verified Instant Workaround Suggestions
  app.get('/api/facilities/workarounds', requireAuth, (_req: Request, res: Response) => {
    const workarounds = ticketRepository.getWorkarounds();
    return res.json({
      success: true,
      workarounds
    });
  });

  // Campus Waste Detector Alerts
  app.get('/api/campus/waste', requireStaff, (_req: Request, res: Response) => {
    const wasteAlerts = ticketRepository.getWasteAlerts();
    return res.json({
      success: true,
      wasteAlerts
    });
  });

  // Campus X-Ray Hotspot Summaries (Privacy-safe aggregate data)
  app.get('/api/campus/xray', requireAuth, (_req: Request, res: Response) => {
    const hotspots = ticketRepository.getCampusXRayHotspots();
    return res.json({
      success: true,
      hotspots
    });
  });

  // --------------------------------------------------------------------------
  // ADMINISTRATOR ROUTES
  // --------------------------------------------------------------------------

  // List all staff and responder members
  app.get('/api/admin/staff', requireAdmin, (_req: Request, res: Response) => {
    const staff = userStore.getAllStaff();
    return res.json({ success: true, staff });
  });

  // Create new staff or responder account
  app.post('/api/admin/staff', requireAdmin, (req: Request, res: Response) => {
    try {
      const { name, email, password, department, role } = req.body;
      if (!name || !email || !password || !department) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      if (!DEPARTMENTS.includes(department as Department)) {
        return res.status(400).json({ success: false, error: 'Invalid department' });
      }

      const assignedRole = role === 'admin' ? 'admin' : role === 'responder' ? 'responder' : 'staff';

      const newStaff = userStore.createStaffMember({
        name,
        email,
        password,
        department,
        role: assignedRole
      });

      return res.status(201).json({ success: true, staff: newStaff });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Update staff or responder member
  app.patch('/api/admin/staff/:id', requireAdmin, (req: Request, res: Response) => {
    const { id } = req.params;
    const { department, isActive, role } = req.body;

    const updated = userStore.updateStaffMember(id, {
      department,
      isActive,
      role
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    return res.json({ success: true, staff: updated });
  });

  // System Operational Metrics
  app.get('/api/admin/metrics', requireAdmin, (_req: Request, res: Response) => {
    const staff = userStore.getAllStaff();
    const stats = ticketRepository.getStatsForUser({
      id: 'admin',
      name: 'Admin',
      email: 'admin@campus.edu',
      role: 'admin',
      isActive: true,
      createdAt: ''
    });

    return res.json({
      success: true,
      metrics: {
        totalTickets: stats.total,
        submitted: stats.submitted,
        underReview: stats.underReview,
        assigned: stats.assigned,
        inProgress: stats.inProgress,
        resolved: stats.resolved,
        reopened: stats.reopened || 0,
        byCategory: stats.byCategory,
        staffCount: staff.length,
        activeStaffCount: staff.filter((s) => s.isActive).length,
        storageStatus: ticketRepository.getStorageStatus()
      }
    });
  });

  // --------------------------------------------------------------------------
  // FRONTEND MOUNTING (VITE / STATIC)
  // --------------------------------------------------------------------------

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CampusConnect Server] Running at http://0.0.0.0:${PORT} (env: ${isProduction ? 'prod' : 'dev'})`);
  });
}

createServer().catch((err) => {
  console.error('[CampusConnect Fatal Server Startup Error]', err);
  process.exit(1);
});
