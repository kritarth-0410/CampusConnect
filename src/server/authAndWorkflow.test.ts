/**
 * Automated Test Suite for CampusConnect Authentication, Authorization,
 * IDOR Protection, and Workflow State Transitions.
 */

import { userStore } from './userStore.js';
import { ticketRepository } from './ticketStore.js';
import { User, VALID_STATUS_TRANSITIONS } from '../shared/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `- ${detail}` : ''}`);
    failed++;
  }
}

async function runAuthAndWorkflowTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting CampusConnect Auth & Workflow Security Tests');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Authentication & Password Hashing
  // --------------------------------------------------------------------------
  console.log('Test Suite 1: Authentication & Password Hashing');

  // Valid student login
  const studentAuth = userStore.authenticate('alex.chen@campus.edu', 'StudentPass2026!');
  assert(studentAuth !== null, 'Valid student credentials authenticate successfully');
  assert(studentAuth?.user.role === 'student', 'Student account has role "student"');
  assert(typeof studentAuth?.token === 'string' && studentAuth.token.length >= 32, 'Session token generated with sufficient entropy');

  // Invalid password
  const badAuth = userStore.authenticate('alex.chen@campus.edu', 'WrongPassword123');
  assert(badAuth === null, 'Incorrect password correctly rejected');

  // Non-existent email
  const ghostAuth = userStore.authenticate('nobody@campus.edu', 'AnyPass123');
  assert(ghostAuth === null, 'Non-existent account correctly rejected');

  // Staff login
  const staffAuth = userStore.authenticate('sarah.supervisor@campus.edu', 'StaffPass2026!');
  assert(staffAuth !== null, 'Staff credentials authenticate successfully');
  assert(staffAuth?.user.role === 'staff', 'Staff account has role "staff"');
  assert(staffAuth?.user.department === 'Plumbing Maintenance Department', 'Staff account has assigned department');

  // Admin login
  const adminAuth = userStore.authenticate('admin@campus.edu', 'AdminPass2026!');
  assert(adminAuth !== null, 'Admin credentials authenticate successfully');
  assert(adminAuth?.user.role === 'admin', 'Admin account has role "admin"');

  // Session validation
  const sessionUser = userStore.validateSession(studentAuth!.token);
  assert(sessionUser?.id === studentAuth?.user.id, 'Session token validates to correct user');

  const invalidSession = userStore.validateSession('fake-token-xyz-123');
  assert(invalidSession === null, 'Invalid session token returns null');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Student Ticket Ownership & IDOR Protection
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 2: Student Ticket Ownership & IDOR Protection');

  const studentAlex = studentAuth!.user;
  const studentPriya = userStore.authenticate('priya.patel@campus.edu', 'StudentPass2026!')!.user;

  // CC-1001 was submitted by Alex Chen
  const alexViewOwn = ticketRepository.getByIdForUser('CC-1001', studentAlex);
  assert(alexViewOwn !== null, 'Student can view their own ticket (CC-1001)');

  // Priya attempts to view Alex's ticket (CC-1001) -> IDOR check must block it!
  const priyaViewAlexTicket = ticketRepository.getByIdForUser('CC-1001', studentPriya);
  assert(priyaViewAlexTicket === null, 'Student is blocked from viewing another student\'s ticket (IDOR Prevention)');

  // Staff can view tickets across all students
  const staffView = ticketRepository.getByIdForUser('CC-1001', staffAuth!.user);
  assert(staffView !== null, 'Staff can view student tickets for triage');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Private Internal Staff Notes Isolation
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 3: Private Internal Staff Notes Isolation');

  // Add internal staff note to CC-1001
  const note = ticketRepository.addInternalNote(
    'CC-1001',
    staffAuth!.user,
    'Confidential test note: Replaced valve seal on west wing riser.'
  );
  assert(note !== null, 'Staff can add internal note to ticket');

  // Staff view contains internal notes
  const staffTicketView = ticketRepository.getByIdForUser('CC-1001', staffAuth!.user) as any;
  assert(Array.isArray(staffTicketView.internalNotes), 'Staff view includes internalNotes array');
  assert(staffTicketView.internalNotes.length > 0, 'Internal note is present in staff response');

  // Student view MUST NOT contain internal notes
  const studentTicketView = ticketRepository.getByIdForUser('CC-1001', studentAlex) as any;
  assert(studentTicketView.internalNotes === undefined, 'Internal notes are completely stripped from student view');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Validated Workflow State Transitions
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 4: Validated Workflow State Transitions');

  // Create a fresh test ticket in "Submitted" status
  const testTicket = ticketRepository.createTicket({
    description: 'Sink leaking continuously in lab 3',
    location: 'Lab 305',
    building: 'Science & Engineering Complex',
    category: 'Plumbing',
    studentUser: studentAlex
  });

  assert(testTicket.status === 'Submitted', 'New ticket initializes in "Submitted" status');

  // Invalid transition: Submitted -> Resolved directly (must be rejected!)
  const invalidTransition = ticketRepository.updateStatus(testTicket.id, 'Resolved', 'Skipping steps', staffAuth!.user);
  assert(!invalidTransition.success, 'State machine rejects skipping from "Submitted" directly to "Resolved"');
  assert(typeof invalidTransition.error === 'string', 'State machine provides clear error explanation for rejected transition');

  // Valid transition: Submitted -> Under Review
  const validTransition1 = ticketRepository.updateStatus(testTicket.id, 'Under Review', 'Verified on site', staffAuth!.user);
  assert(validTransition1.success, 'Valid transition "Submitted" -> "Under Review" succeeded');

  // Valid transition: Under Review -> Assigned
  const validTransition2 = ticketRepository.updateStatus(testTicket.id, 'Assigned', 'Assigned to plumber', staffAuth!.user);
  assert(validTransition2.success, 'Valid transition "Under Review" -> "Assigned" succeeded');

  // Valid transition: Assigned -> In Progress
  const validTransition3 = ticketRepository.updateStatus(testTicket.id, 'In Progress', 'Work commenced', staffAuth!.user);
  assert(validTransition3.success, 'Valid transition "Assigned" -> "In Progress" succeeded');

  // Valid transition: In Progress -> Resolved REQUIRES Proof of Fix!
  // Attempting to resolve WITHOUT Proof of Fix must fail:
  const resolveWithoutProof = ticketRepository.updateStatus(testTicket.id, 'Resolved', 'Work finished', staffAuth!.user);
  assert(!resolveWithoutProof.success, 'Rejects transition to "Resolved" without mandatory Proof of Fix');
  assert(resolveWithoutProof.error?.includes('Proof of Fix') === true, 'Error specifically cites missing Proof of Fix requirement');

  // Submit valid Proof of Fix
  const proofSubmission = ticketRepository.submitProofOfFix(
    testTicket.id,
    'data:image/svg+xml;utf8,<svg><text>Fixed Pipe</text></svg>',
    'Replaced compression washer and resealed valve joint with teflon tape.',
    staffAuth!.user
  );
  assert(proofSubmission.success, 'Submitting valid Proof of Fix succeeds');

  // Now transition: In Progress -> Resolved should SUCCEED
  const validTransition4 = ticketRepository.updateStatus(testTicket.id, 'Resolved', 'Work completed and tested', staffAuth!.user);
  assert(validTransition4.success, 'Valid transition "In Progress" -> "Resolved" succeeded with Proof of Fix attached');
  assert(testTicket.resolvedAt !== undefined, 'Ticket records resolution timestamp upon reaching "Resolved"');

  // Student Reopening Ticket: Resolved -> Reopened
  const reopenResult = ticketRepository.reopenTicket(
    testTicket.id,
    studentAlex,
    'Pipe started dripping again when faucet pressure was turned to maximum.'
  );
  assert(reopenResult.success, 'Student can reopen a Resolved ticket');
  assert(reopenResult.ticket?.status === 'Reopened', 'Ticket status correctly transitions to "Reopened"');
  assert(reopenResult.ticket?.reopenReason !== undefined, 'Reopen reason is tracked on ticket');

  // Transition from Reopened -> Under Review by Staff
  const reopenToUnderReview = ticketRepository.updateStatus(testTicket.id, 'Under Review', 'Investigating recurring leak', staffAuth!.user);
  assert(reopenToUnderReview.success, 'Staff can advance "Reopened" ticket back into "Under Review" triage');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Human Supervised Duplicate Review Policy
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 5: Human Supervised Duplicate Review Policy');

  const reviewed = ticketRepository.reviewDuplicate(
    testTicket.id,
    'confirmed',
    staffAuth!.user,
    'Confirmed identical leak to CC-1001'
  );

  assert(reviewed !== null, 'Staff duplicate review recorded successfully');
  assert(reviewed?.duplicateReviewed === true, 'Duplicate reviewed flag set to true');
  assert(reviewed?.duplicateReviewDecision === 'confirmed', 'Duplicate review decision matches "confirmed"');
  assert(reviewed?.status === 'Under Review', 'Status was not automatically closed or rejected solely due to duplicate review');

  // --------------------------------------------------------------------------
  // TEST SUITE 6: Student Profile Setup & Persistence & IDOR Protection
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 6: Student Profile Setup & Persistence & Ownership');

  const initialProfile = userStore.getStudentProfile(studentAlex.id);
  assert(initialProfile !== null, 'Student profile exists or is initialized');

  const profileUpdateResult = userStore.updateStudentProfile(studentAlex.id, {
    fullName: 'Alex Chen',
    enrollmentNumber: 'EN-2024-CS-088',
    mobileNumber: '+1 (555) 392-8819',
    course: 'B.S. Computer Science',
    yearOrSemester: 'Year 3 (Sem 5)',
    campus: 'North Campus',
    hostelOrBlock: 'North Residential Hall',
    floor: '2nd Floor',
    roomNumber: 'Room 204',
    emergencyContactName: 'David Chen (Parent)',
    emergencyContactPhone: '+1 (555) 901-2244'
  });

  assert(profileUpdateResult.success === true, 'Profile updated successfully');
  assert(profileUpdateResult.profile?.isComplete === true, 'Profile marked as complete with all required fields filled');
  assert(profileUpdateResult.profile?.enrollmentNumber === 'EN-2024-CS-088', 'Student enrollment number persisted');
  assert(profileUpdateResult.profile?.hostelOrBlock === 'North Residential Hall', 'Hostel building persisted');

  // Persistence check: Fetch again from store
  const fetchedProfile = userStore.getStudentProfile(studentAlex.id);
  assert(fetchedProfile?.hostelOrBlock === 'North Residential Hall', 'Saved profile survives in-memory and disk re-query');

  // Verify Priya has her own separate profile
  const priyaProfile = userStore.getStudentProfile(studentPriya.id);
  assert(priyaProfile?.fullName !== profileUpdateResult.profile?.fullName, 'Profiles are strictly isolated per authenticated user');

  // --------------------------------------------------------------------------
  // TEST SUITE 7: Emergency Incidents & 15s Rapid Double-Tap Deduplication
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 7: Emergency Response & Deduplication');

  const emergency1Res = ticketRepository.createEmergencyIncident({
    emergencyType: 'medical',
    notes: 'Student experiencing severe asthma attack in physics lab',
    building: 'Science & Engineering Complex',
    floor: '2nd Floor',
    room: 'Physics Lab 202',
    gps: { latitude: 37.7749, longitude: -122.4194, accuracy: 4.5, timestamp: new Date().toISOString() },
    studentUser: studentAlex
  });

  const emergency1 = emergency1Res.incident;
  assert(emergency1.status === 'Awaiting acknowledgement', 'Emergency initializes with "Awaiting acknowledgement" status');
  assert(emergency1.notificationAttempts.length > 0, 'Emergency creates responder notification attempts');
  assert(emergency1.gps?.latitude === 37.7749, 'Emergency coordinates recorded accurately');
  assert(emergency1.studentName === 'Alex Chen', 'Emergency prefilled with student profile name');

  // Rapid double-tap test within 15 seconds: identical student, location & type
  const emergencyDuplicateRes = ticketRepository.createEmergencyIncident({
    emergencyType: 'medical',
    notes: 'Student experiencing severe asthma attack in physics lab (panicked second tap)',
    building: 'Science & Engineering Complex',
    floor: '2nd Floor',
    room: 'Physics Lab 202',
    studentUser: studentAlex
  });

  assert(
    emergencyDuplicateRes.isDuplicateSuppressed === true,
    'Rapid double-tap within 15s suppresses duplicate (prevents panic duplicates)'
  );
  assert(
    emergencyDuplicateRes.incident.id === emergency1.id,
    'Suppressed duplicate returns existing active incident'
  );

  // --------------------------------------------------------------------------
  // TEST SUITE 8: Medical & Security Responder Actions & Timeline
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 8: Medical & Security Responder Actions');

  // Authenticate as Medical Responder
  const medicalResponderAuth = userStore.authenticate('medical.officer@campus.edu', 'ResponderPass2026!');
  assert(medicalResponderAuth !== null, 'Medical officer credentials authenticate successfully');
  assert(medicalResponderAuth?.user.role === 'responder', 'Account has role "responder"');

  // Responder views emergencies
  const responderIncidents = ticketRepository.getEmergencyIncidentsForUser(medicalResponderAuth!.user);
  assert(responderIncidents.length > 0, 'Responder can view emergency queue');

  // Responder acknowledges incident
  const ackRes = ticketRepository.acknowledgeEmergency(
    emergency1.id,
    medicalResponderAuth!.user,
    'Medical unit en route with oxygen and nebulizer kit.'
  );
  assert(ackRes.success, 'Responder successfully acknowledges emergency');
  assert(ackRes.incident?.status === 'Acknowledged', 'Emergency status updated to "Acknowledged"');
  assert(ackRes.incident?.acknowledgedByName?.includes('Anita Rao') === true, 'Acknowledged responder name recorded');

  // Responder updates to Responding
  const respondingRes = ticketRepository.updateEmergencyStatus(
    emergency1.id,
    'Responding',
    medicalResponderAuth!.user,
    'First responders arrived at Physics Lab 202.'
  );
  assert(respondingRes.success, 'Responder marks status "Responding"');

  // Responder closes incident
  const resolvedRes = ticketRepository.updateEmergencyStatus(
    emergency1.id,
    'Resolved',
    medicalResponderAuth!.user,
    'Patient stabilized and transferred to campus health center. Vitals normal.'
  );
  assert(resolvedRes.success, 'Responder marks status "Resolved"');
  assert(resolvedRes.incident?.resolvedAt !== undefined, 'Resolution timestamp recorded');

  // --------------------------------------------------------------------------
  // TEST SUITE 9: Priority Engine & Staff Priority Override
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 9: Impact Priority Engine & Staff Override');

  // Test ticket with safety hazard gets Urgent priority recommendation
  const urgentTicket = ticketRepository.createTicket({
    description: 'Live wire exposed with sparks and smoke near elevator doorway',
    building: 'Science & Engineering Complex',
    location: '1st Floor Elevator Foyer',
    category: 'Electricity',
    studentUser: studentAlex
  });

  assert(urgentTicket.priorityRecommendation !== undefined, 'Ticket receives automated Priority Engine recommendation');
  assert(
    urgentTicket.priorityRecommendation?.priority === 'Emergency' ||
    urgentTicket.priorityRecommendation?.priority === 'High',
    'Safety hazard with sparks and smoke gets Emergency or High priority'
  );
  assert(urgentTicket.priorityRecommendation?.reasons.length! > 0, 'Priority recommendation lists specific justification reasons');

  // Staff overrides priority with audit log
  const overrideRes = ticketRepository.overridePriority(
    urgentTicket.id,
    'Emergency',
    'Verified active electrical hazard in high-traffic elevator lobby during peak class changeover.',
    staffAuth!.user
  );
  assert(overrideRes !== null, 'Staff priority override succeeds');
  assert(overrideRes?.priorityOverride?.priority === 'Emergency', 'Ticket priority override recorded');
  assert(overrideRes?.priorityOverride?.overriddenBy === staffAuth!.user.name, 'Audit log records supervisor name');
  assert(overrideRes?.priorityOverride?.reason.includes('elevator lobby') === true, 'Audit log records explicit reason');

  // Active Blockers Tracker
  const blockerTicket = ticketRepository.addBlocker(
    urgentTicket.id,
    'Waiting for high-amperage 40A Schneider circuit breaker delivery from regional supplier',
    staffAuth!.user
  );
  assert(blockerTicket !== null, 'Staff can log an active work blocker');
  assert(blockerTicket?.blockers?.length === 1, 'Active blocker is tracked on ticket');

  // --------------------------------------------------------------------------
  // TEST SUITE 10: Recurring Issue Clustering (10 in 2h Window)
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 10: Recurring Issue Clustering Engine');

  // Create 10 complaints in the same location and category within 2 hours
  for (let i = 1; i <= 10; i++) {
    ticketRepository.createTicket({
      description: `Wi-Fi signal drops constantly on laptop and phone in room ${i % 3 === 0 ? '401' : '402'}`,
      building: 'Hostel Block C',
      location: 'Floor 4 West Wing',
      category: 'Internet Connectivity',
      studentUser: studentAlex
    });
  }

  const clusters = ticketRepository.getClusters();
  const wifiCluster = clusters.find(c => c.building === 'Hostel Block C' && c.category === 'Internet Connectivity');
  assert(wifiCluster !== undefined, 'Clustering engine detected 10+ complaints in 2h and created cluster');
  assert(wifiCluster?.ticketIds.length! >= 10, 'Cluster aggregates all 10 matching ticket IDs');
  assert(wifiCluster?.priority === 'High', 'Cluster sets High priority');

  // Staff reviews cluster
  const reviewedCluster = ticketRepository.reviewCluster(
    wifiCluster!.id,
    'resolve',
    staffAuth!.user,
    'Access point firmware update completed.'
  );
  assert(reviewedCluster?.status === 'Resolved', 'Cluster status advances to Resolved');

  // --------------------------------------------------------------------------
  // TEST SUITE 11: Repeat Offenders, Readiness, Workarounds & X-Ray Hotspots
  // --------------------------------------------------------------------------
  console.log('\nTest Suite 11: Campus Operations Intelligence (Repeat Offenders & X-Ray)');

  const repeatOffenders = ticketRepository.getRepeatOffenders();
  assert(Array.isArray(repeatOffenders), 'Repeat offender query returns structured list');

  const classroomReadiness = ticketRepository.getClassroomReadiness();
  assert(Array.isArray(classroomReadiness), 'Classroom readiness returns scores and active blocker stats');

  const workarounds = ticketRepository.getWorkarounds();
  assert(Array.isArray(workarounds), 'Instant facility workarounds list is available');

  const wasteAlerts = ticketRepository.getWasteAlerts();
  assert(Array.isArray(wasteAlerts), 'Campus waste detector returns resource loss alerts');

  const xrayHotspots = ticketRepository.getCampusXRayHotspots();
  assert(Array.isArray(xrayHotspots), 'Campus X-Ray returns infrastructure hotspots');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`📊 Auth & Workflow Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthAndWorkflowTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});

