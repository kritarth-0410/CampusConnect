/**
 * CampusConnect - Production Full-Stack Server
 * Features:
 * - Real role-based authentication (Student, Staff, Admin)
 * - Server-side authorization on every protected route (no client-side bypass)
 * - Insecure Direct Object Reference (IDOR) prevention
 * - Internal staff notes separation (stripped from student API responses)
 * - Validated workflow state transitions
 * - Server-side Gemini 3.8 Flash AI integration
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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

  // Middleware for JSON bodies (supports up to 5MB for base64 photo attachments)
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

  // Sign In (Students, Staff, Admin)
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
  // AI COMPLAINT TRIAGE ROUTES
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

      // Run server-side Gemini AI analysis
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

      // Strict validation of the 4 allowed categories
      if (!TICKET_CATEGORIES.includes(category as TicketCategory)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category: "${category}". Must be one of: ${TICKET_CATEGORIES.join(', ')}`
        });
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
      // Check if ticket exists but user is not allowed (IDOR check)
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

  // Update Status (Staff / Admin only with state machine validation)
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
  // ADMINISTRATOR ROUTES
  // --------------------------------------------------------------------------

  // List all staff members
  app.get('/api/admin/staff', requireAdmin, (_req: Request, res: Response) => {
    const staff = userStore.getAllStaff();
    return res.json({ success: true, staff });
  });

  // Create new staff account
  app.post('/api/admin/staff', requireAdmin, (req: Request, res: Response) => {
    try {
      const { name, email, password, department, role } = req.body;
      if (!name || !email || !password || !department) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
      }

      if (!DEPARTMENTS.includes(department as Department)) {
        return res.status(400).json({ success: false, error: 'Invalid department' });
      }

      const newStaff = userStore.createStaffMember({
        name,
        email,
        password,
        department,
        role: role === 'admin' ? 'admin' : 'staff'
      });

      return res.status(201).json({ success: true, staff: newStaff });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Update staff member
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
    const allTickets = ticketRepository.getTicketsForUser({
      id: 'admin',
      name: 'Admin',
      email: 'admin@campus.edu',
      role: 'admin',
      isActive: true,
      createdAt: ''
    }) as any[];

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
        byCategory: stats.byCategory,
        staffCount: staff.length,
        activeStaffCount: staff.filter(s => s.isActive).length,
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
