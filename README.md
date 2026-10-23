# CampusConnect — Production Campus Maintenance Management Platform

**CampusConnect** is a full-stack web application designed for higher-education campuses to streamline facility maintenance requests. It bridges the communication gap between students and campus physical plant operations through server-side Gemini 3.8 Flash AI triage, role-based access control, cryptographic authentication, and validated resolution workflows.

---

## 1. Architecture Overview

- **Frontend:** React 19 SPA, TypeScript, Tailwind CSS v4, Lucide React icons, Motion.
- **Backend:** Node.js, Express, TypeScript (`server.ts`).
- **AI Intelligence:** Server-side Gemini 3.8 Flash (`@google/genai` SDK) with heuristic fallback engine.
- **Authentication:** Server-enforced PBKDF2 cryptographic password hashing, signed session tokens, and strict role guards (`student`, `staff`, `admin`).
- **Data Persistence:** File-backed persistent storage in `.data/tickets.json` and `.data/users.json` with transactional atomic writes.
- **Security & Privacy:** Server-enforced Insecure Direct Object Reference (IDOR) prevention, internal notes isolation, input validation, and security headers.

---

## 2. Protected Application Areas & Roles

### Student Portal (`/`)
- Authenticated student session management.
- **My Complaints:** View personal complaints and real-time status transitions.
- **Submit Complaint:** Multi-step form with campus building, specific room, informal description, and optional photo upload (JPEG, PNG, WebP < 5MB).
- **Gemini Triage Assistance:** Real-time AI categorization into the 4 supported campus categories, confidence scoring, department routing, and clarification questions.
- **Progress Timeline:** 5-stage milestone tracker (`Submitted` → `Under Review` → `Assigned` → `In Progress` → `Resolved`).
- **Privacy:** Students cannot view other students' tickets. Internal staff notes are stripped from student responses on the server.

### Staff Dispatch Board (`/staff`)
- Protected access restricted to certified staff and administrators.
- Comprehensive metrics computed from real stored database records.
- Multi-parameter filtering by Category, Status, Department, Building, and search query.
- Detail drawer with student description, photo evidence, AI technical summary, and confidence score.
- **Duplicate Review:** Advisory warnings comparing similar active tickets; staff confirm or dismiss warnings without automated closure.
- **Assignment:** Assigns tickets to certified department personnel with priority ratings (`Low`, `Medium`, `High`, `Emergency`).
- **Status Workflow:** Server-enforced valid transitions.
- **Internal Staff Notes:** Private technician notes isolated from students.

### Administrator Console (`/admin`)
- Restricted to users with the `admin` role.
- **Staff Provisioning:** Create, activate, or suspend staff member accounts with assigned department divisions.
- **Department & Category Review:** Strict routing policy configuration.
- **Operational Metrics:** Real-time database metrics, ticket volume distribution, and storage engine health.

---

## 3. Strict 4-Category Boundary & Routing

1. **Plumbing** &rarr; `Plumbing Maintenance Department`
2. **Electricity** &rarr; `Electrical Systems & Safety Division`
3. **Cleanliness** &rarr; `Campus Custodial & Sanitation Services`
4. **Internet Connectivity** &rarr; `IT & Network Infrastructure Team`

---

## 4. Default Verified Credentials

| Role | Name | Email | Password |
|---|---|---|---|
| **Administrator** | Facilities Administrator | `admin@campus.edu` | `AdminPass2026!` |
| **Staff Supervisor** | Sarah Martinez | `sarah.supervisor@campus.edu` | `StaffPass2026!` |
| **Staff Electrician** | Marcus Vance | `marcus.vance@campus.edu` | `StaffPass2026!` |
| **Staff Plumber** | Carlos Rivera | `carlos.rivera@campus.edu` | `StaffPass2026!` |
| **Staff Custodial** | Elena Gomez | `elena.gomez@campus.edu` | `StaffPass2026!` |
| **Staff IT NOC** | Maya Lin | `maya.lin@campus.edu` | `StaffPass2026!` |
| **Student** | Alex Chen | `alex.chen@campus.edu` | `StudentPass2026!` |
| **Student** | Priya Patel | `priya.patel@campus.edu` | `StudentPass2026!` |

*Students may also self-register with any valid email and password.*

---

## 5. Testing & Verification

Run the automated test suites covering AI classification, multimodal input, error fallback, password hashing, IDOR protection, internal notes isolation, and state machine validation:

```bash
# Run all 64 automated tests
npm test

# Verify TypeScript compilation
npm run lint

# Production build check
npm run build
```

---

## 6. Cloud Run & Production Deployment

1. Ensure `GEMINI_API_KEY` is configured in your hosting environment / Secret Manager.
2. In Google AI Studio, click the **Publish** or **Deploy** button.
3. The server starts with `npm run start` (`tsx server.ts`), binding automatically to `0.0.0.0:3000` (or the port defined by `PORT`).
