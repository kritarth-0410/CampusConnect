/**
 * CampusConnect - User Management & Authentication Storage
 * File-backed persistence in .data/users.json with secure password hashing (PBKDF2/scrypt),
 * token-based session management, and persistent student profile setup.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Department, StudentProfile, User, UserRole } from '../shared/types.js';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

interface StoredUserRecord extends User {
  passwordHash: string;
  salt: string;
  profile?: StudentProfile;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export class UserStore {
  private users: Map<string, StoredUserRecord> = new Map(); // keyed by id
  private emailIndex: Map<string, string> = new Map(); // email -> id
  private sessions: Map<string, StoredSession> = new Map(); // token -> session

  constructor() {
    this.initStore();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  private initStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.users)) {
          for (const u of data.users) {
            this.users.set(u.id, u);
            this.emailIndex.set(u.email.toLowerCase(), u.id);
          }
        }
        if (Array.isArray(data.sessions)) {
          const now = Date.now();
          for (const s of data.sessions) {
            if (new Date(s.expiresAt).getTime() > now) {
              this.sessions.set(s.token, s);
            }
          }
        }
        // Ensure responder accounts and profiles exist
        this.ensureDefaultAccounts();
        console.log(`[UserStore] Loaded ${this.users.size} user accounts.`);
        return;
      }
    } catch (err) {
      console.warn('[UserStore] Error loading users from disk, seeding defaults:', err);
    }

    this.seedDefaultUsers();
    this.persistToDisk();
  }

  private persistToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload = {
        updatedAt: new Date().toISOString(),
        users: Array.from(this.users.values()),
        sessions: Array.from(this.sessions.values())
      };
      const tempPath = `${USERS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tempPath, USERS_FILE);
    } catch (err) {
      console.error('[UserStore] Failed to write users to disk:', err);
    }
  }

  private ensureDefaultAccounts() {
    let changed = false;
    const responders: Array<{
      id: string;
      name: string;
      email: string;
      password: string;
      role: UserRole;
      department: Department;
    }> = [
      {
        id: 'user-responder-medical',
        name: 'Dr. Anita Rao (Campus Health Officer)',
        email: 'medical.officer@campus.edu',
        password: 'ResponderPass2026!',
        role: 'responder',
        department: 'University Health & Medical Center'
      },
      {
        id: 'user-responder-security',
        name: 'Capt. Vikram Singh (Campus Security Chief)',
        email: 'security.chief@campus.edu',
        password: 'ResponderPass2026!',
        role: 'responder',
        department: 'Campus Safety & Emergency Security'
      }
    ];

    for (const r of responders) {
      if (!this.emailIndex.has(r.email.toLowerCase())) {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = this.hashPassword(r.password, salt);
        const record: StoredUserRecord = {
          id: r.id,
          name: r.name,
          email: r.email.toLowerCase(),
          passwordHash,
          salt,
          role: r.role,
          department: r.department,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        this.users.set(record.id, record);
        this.emailIndex.set(record.email, record.id);
        changed = true;
      }
    }

    // Ensure student-1 has a verified profile seeded
    const alex = this.users.get('user-student-1');
    if (alex && !alex.profile) {
      alex.profile = {
        userId: alex.id,
        fullName: 'Alex Chen',
        enrollmentNumber: 'EN-2024-CS-088',
        mobileNumber: '+1 (555) 392-8819',
        collegeEmail: alex.email,
        course: 'B.S. Computer Science',
        yearOrSemester: 'Year 3 (Sem 5)',
        campus: 'North Campus',
        hostelOrBlock: 'North Residential Hall',
        floor: '2nd Floor',
        roomNumber: 'Room 204',
        emergencyContactName: 'David Chen (Parent)',
        emergencyContactPhone: '+1 (555) 901-2244',
        isComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      changed = true;
    }

    if (changed) {
      this.persistToDisk();
    }
  }

  private seedDefaultUsers() {
    const defaultAccounts: Array<{
      id: string;
      name: string;
      email: string;
      password: string;
      role: UserRole;
      department?: Department;
      profile?: StudentProfile;
    }> = [
      {
        id: 'user-admin-1',
        name: 'Facilities Administrator',
        email: 'admin@campus.edu',
        password: 'AdminPass2026!',
        role: 'admin'
      },
      {
        id: 'user-staff-1',
        name: 'Sarah Martinez (Triage Supervisor)',
        email: 'sarah.supervisor@campus.edu',
        password: 'StaffPass2026!',
        role: 'staff',
        department: 'Plumbing Maintenance Department'
      },
      {
        id: 'user-staff-2',
        name: 'Carlos Rivera (Master Plumber)',
        email: 'carlos.rivera@campus.edu',
        password: 'StaffPass2026!',
        role: 'staff',
        department: 'Plumbing Maintenance Department'
      },
      {
        id: 'user-staff-3',
        name: 'Marcus Vance (Senior Electrician)',
        email: 'marcus.vance@campus.edu',
        password: 'StaffPass2026!',
        role: 'staff',
        department: 'Electrical Systems & Safety Division'
      },
      {
        id: 'user-staff-4',
        name: 'Elena Gomez (Custodial Lead)',
        email: 'elena.gomez@campus.edu',
        password: 'StaffPass2026!',
        role: 'staff',
        department: 'Campus Custodial & Sanitation Services'
      },
      {
        id: 'user-staff-5',
        name: 'Maya Lin (NOC Wireless Engineer)',
        email: 'maya.lin@campus.edu',
        password: 'StaffPass2026!',
        role: 'staff',
        department: 'IT & Network Infrastructure Team'
      },
      {
        id: 'user-responder-medical',
        name: 'Dr. Anita Rao (Campus Health Officer)',
        email: 'medical.officer@campus.edu',
        password: 'ResponderPass2026!',
        role: 'responder',
        department: 'University Health & Medical Center'
      },
      {
        id: 'user-responder-security',
        name: 'Capt. Vikram Singh (Campus Security Chief)',
        email: 'security.chief@campus.edu',
        password: 'ResponderPass2026!',
        role: 'responder',
        department: 'Campus Safety & Emergency Security'
      },
      {
        id: 'user-student-1',
        name: 'Alex Chen',
        email: 'alex.chen@campus.edu',
        password: 'StudentPass2026!',
        role: 'student',
        profile: {
          userId: 'user-student-1',
          fullName: 'Alex Chen',
          enrollmentNumber: 'EN-2024-CS-088',
          mobileNumber: '+1 (555) 392-8819',
          collegeEmail: 'alex.chen@campus.edu',
          course: 'B.S. Computer Science',
          yearOrSemester: 'Year 3 (Sem 5)',
          campus: 'North Campus',
          hostelOrBlock: 'North Residential Hall',
          floor: '2nd Floor',
          roomNumber: 'Room 204',
          emergencyContactName: 'David Chen (Parent)',
          emergencyContactPhone: '+1 (555) 901-2244',
          isComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      {
        id: 'user-student-2',
        name: 'Priya Patel',
        email: 'priya.patel@campus.edu',
        password: 'StudentPass2026!',
        role: 'student',
        profile: {
          userId: 'user-student-2',
          fullName: 'Priya Patel',
          enrollmentNumber: 'EN-2023-EE-042',
          mobileNumber: '+1 (555) 749-3021',
          collegeEmail: 'priya.patel@campus.edu',
          course: 'B.S. Electrical Engineering',
          yearOrSemester: 'Year 4 (Sem 7)',
          campus: 'Central Campus',
          hostelOrBlock: 'South Quad Dorms',
          floor: '3rd Floor',
          roomNumber: 'Room 312',
          emergencyContactName: 'Rekha Patel (Mother)',
          emergencyContactPhone: '+1 (555) 441-9988',
          isComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    ];

    for (const acc of defaultAccounts) {
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = this.hashPassword(acc.password, salt);
      const userRecord: StoredUserRecord = {
        id: acc.id,
        name: acc.name,
        email: acc.email.toLowerCase(),
        passwordHash,
        salt,
        role: acc.role,
        department: acc.department,
        profile: acc.profile,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      this.users.set(userRecord.id, userRecord);
      this.emailIndex.set(userRecord.email, userRecord.id);
    }
  }

  public authenticate(email: string, password: string): { user: User; token: string } | null {
    if (!email || !password) return null;
    const cleanEmail = email.trim().toLowerCase();
    const userId = this.emailIndex.get(cleanEmail);
    if (!userId) return null;

    const record = this.users.get(userId);
    if (!record || !record.isActive) return null;

    const computed = this.hashPassword(password, record.salt);
    if (computed !== record.passwordHash) return null;

    // Generate secure session token (30 days validity)
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const session: StoredSession = {
      token,
      userId: record.id,
      createdAt: now.toISOString(),
      expiresAt
    };
    this.sessions.set(token, session);
    this.persistToDisk();

    return {
      user: this.toPublicUser(record),
      token
    };
  }

  public registerStudent(name: string, email: string, password: string): { user: User; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (this.emailIndex.has(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);
    const id = `user-student-${Date.now()}`;

    // Initialize with partial profile
    const initialProfile: StudentProfile = {
      userId: id,
      fullName: name.trim(),
      enrollmentNumber: '',
      mobileNumber: '',
      collegeEmail: cleanEmail,
      course: '',
      yearOrSemester: '',
      campus: '',
      isComplete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const record: StoredUserRecord = {
      id,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      role: 'student',
      profile: initialProfile,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    this.users.set(id, record);
    this.emailIndex.set(cleanEmail, id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    this.sessions.set(token, {
      token,
      userId: id,
      createdAt: new Date().toISOString(),
      expiresAt
    });

    this.persistToDisk();
    return {
      user: this.toPublicUser(record),
      token
    };
  }

  public validateSession(token: string): User | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      this.persistToDisk();
      return null;
    }

    const userRecord = this.users.get(session.userId);
    if (!userRecord || !userRecord.isActive) return null;

    return this.toPublicUser(userRecord);
  }

  public logout(token: string): boolean {
    if (!token) return false;
    const deleted = this.sessions.delete(token);
    if (deleted) this.persistToDisk();
    return deleted;
  }

  /**
   * Student Profile Management (Enforces authenticated user ownership)
   */
  public getStudentProfile(userId: string): StudentProfile | null {
    const record = this.users.get(userId);
    if (!record || record.role !== 'student') return null;

    if (!record.profile) {
      // Create empty profile structure if missing
      record.profile = {
        userId: record.id,
        fullName: record.name,
        enrollmentNumber: '',
        mobileNumber: '',
        collegeEmail: record.email,
        course: '',
        yearOrSemester: '',
        campus: '',
        isComplete: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.persistToDisk();
    }
    return record.profile;
  }

  public updateStudentProfile(
    userId: string,
    updates: Partial<StudentProfile>
  ): { success: boolean; profile?: StudentProfile; error?: string } {
    const record = this.users.get(userId);
    if (!record) {
      return { success: false, error: 'User account not found' };
    }
    if (record.role !== 'student') {
      return { success: false, error: 'Only student accounts maintain student profiles' };
    }

    const existing = record.profile || {
      userId: record.id,
      fullName: record.name,
      enrollmentNumber: '',
      mobileNumber: '',
      collegeEmail: record.email,
      course: '',
      yearOrSemester: '',
      campus: '',
      isComplete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validation
    const fullName = updates.fullName !== undefined ? updates.fullName.trim() : existing.fullName;
    const enrollmentNumber =
      updates.enrollmentNumber !== undefined ? updates.enrollmentNumber.trim() : existing.enrollmentNumber;
    const mobileNumber = updates.mobileNumber !== undefined ? updates.mobileNumber.trim() : existing.mobileNumber;
    const course = updates.course !== undefined ? updates.course.trim() : existing.course;
    const yearOrSemester =
      updates.yearOrSemester !== undefined ? updates.yearOrSemester.trim() : existing.yearOrSemester;
    const campus = updates.campus !== undefined ? updates.campus.trim() : existing.campus;

    if (!fullName) {
      return { success: false, error: 'Full name is required' };
    }
    if (!enrollmentNumber) {
      return { success: false, error: 'Student ID / Enrollment Number is required' };
    }
    if (!mobileNumber || mobileNumber.length < 8) {
      return { success: false, error: 'Valid registered mobile number is required' };
    }
    if (!course) {
      return { success: false, error: 'Department / Course is required' };
    }
    if (!yearOrSemester) {
      return { success: false, error: 'Year / Semester is required' };
    }
    if (!campus) {
      return { success: false, error: 'Campus / Site selection is required' };
    }

    // Check completeness
    const isComplete = Boolean(fullName && enrollmentNumber && mobileNumber && course && yearOrSemester && campus);

    const updatedProfile: StudentProfile = {
      ...existing,
      fullName,
      enrollmentNumber,
      mobileNumber,
      collegeEmail: record.email,
      course,
      yearOrSemester,
      campus,
      hostelOrBlock: updates.hostelOrBlock !== undefined ? updates.hostelOrBlock.trim() : existing.hostelOrBlock,
      floor: updates.floor !== undefined ? updates.floor.trim() : existing.floor,
      roomNumber: updates.roomNumber !== undefined ? updates.roomNumber.trim() : existing.roomNumber,
      emergencyContactName:
        updates.emergencyContactName !== undefined
          ? updates.emergencyContactName.trim()
          : existing.emergencyContactName,
      emergencyContactPhone:
        updates.emergencyContactPhone !== undefined
          ? updates.emergencyContactPhone.trim()
          : existing.emergencyContactPhone,
      isComplete,
      updatedAt: new Date().toISOString()
    };

    record.profile = updatedProfile;
    record.name = fullName; // Sync user display name
    this.persistToDisk();

    return {
      success: true,
      profile: updatedProfile
    };
  }

  public createStaffMember(params: {
    name: string;
    email: string;
    password: string;
    department: Department;
    role: 'staff' | 'admin' | 'responder';
  }): User {
    const cleanEmail = params.email.trim().toLowerCase();
    if (this.emailIndex.has(cleanEmail)) {
      throw new Error('User with this email already exists');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(params.password, salt);
    const id = `user-${params.role}-${Date.now()}`;

    const record: StoredUserRecord = {
      id,
      name: params.name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      role: params.role,
      department: params.department,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    this.users.set(id, record);
    this.emailIndex.set(cleanEmail, id);
    this.persistToDisk();

    return this.toPublicUser(record);
  }

  public updateStaffMember(
    id: string,
    updates: { department?: Department; isActive?: boolean; role?: 'staff' | 'admin' | 'responder' }
  ): User | null {
    const record = this.users.get(id);
    if (!record) return null;

    if (updates.department !== undefined) record.department = updates.department;
    if (updates.isActive !== undefined) record.isActive = updates.isActive;
    if (updates.role !== undefined) record.role = updates.role;

    this.persistToDisk();
    return this.toPublicUser(record);
  }

  public getAllStaff(): User[] {
    return Array.from(this.users.values())
      .filter((u) => u.role === 'staff' || u.role === 'admin' || u.role === 'responder')
      .map((r) => this.toPublicUser(r));
  }

  public getUserById(id: string): User | null {
    const u = this.users.get(id);
    return u ? this.toPublicUser(u) : null;
  }

  private toPublicUser(record: StoredUserRecord): User {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      department: record.department,
      profile: record.profile,
      isActive: record.isActive,
      createdAt: record.createdAt
    };
  }
}

export const userStore = new UserStore();
