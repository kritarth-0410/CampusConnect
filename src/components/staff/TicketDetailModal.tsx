import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  HardHat,
  User,
  ShieldAlert,
  Send,
  ArrowRight,
  FileText,
  MapPin,
  ExternalLink,
  Layers,
  Lock,
  MessageSquare,
  Camera,
  FileCheck,
  AlertOctagon,
  RotateCcw,
  Check
} from 'lucide-react';
import {
  Ticket,
  TicketStatus,
  TICKET_STATUSES,
  DEPARTMENTS,
  Department,
  CATEGORY_DEPARTMENT_ROUTING,
  VALID_STATUS_TRANSITIONS
} from '../../shared/types.js';
import { CategoryBadge } from '../common/CategoryBadge.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { apiClient } from '../../services/apiClient.js';
import { DEPARTMENT_TECHNICIANS } from './staffUtils.js';
import { useAuth } from '../../context/AuthContext.js';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onTicketUpdated: (updatedTicket: Ticket) => void;
  onNavigateToTicket: (ticketId: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  onTicketUpdated,
  onNavigateToTicket
}) => {
  const { user } = useAuth();

  // Status update state
  const [statusNote, setStatusNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Proof of Fix state (Required before marking 'Resolved')
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [proofPhotoUri, setProofPhotoUri] = useState<string | null>(null);
  const [proofSummary, setProofSummary] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Assignment state
  const [assignDept, setAssignDept] = useState<Department>(
    ticket.assignment?.department || CATEGORY_DEPARTMENT_ROUTING[ticket.category]
  );
  const [technicianName, setTechnicianName] = useState(ticket.assignment?.assignedTo || '');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>(
    ticket.assignment?.priority || ticket.priorityRecommendation?.priority || 'Medium'
  );
  const [assignNotes, setAssignNotes] = useState(ticket.assignment?.notes || '');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Priority Override State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overridePriorityVal, setOverridePriorityVal] = useState<'Low' | 'Medium' | 'High' | 'Emergency'>('High');
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  // Blocker State
  const [blockerText, setBlockerText] = useState('');
  const [isAddingBlocker, setIsAddingBlocker] = useState(false);

  // Internal staff note state
  const [newInternalNote, setNewInternalNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Duplicate review state
  const [isReviewingDuplicate, setIsReviewingDuplicate] = useState(false);

  // Handle Proof Photo
  const handleProofPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProofError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProofError('Photo exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setProofPhotoUri(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Proof of Fix and resolve
  const handleProofOfFixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofPhotoUri) {
      setProofError('A verified resolution photograph is required.');
      return;
    }
    if (!proofSummary.trim() || proofSummary.trim().length < 5) {
      setProofError('A detailed resolution summary is required (min 5 characters).');
      return;
    }

    setIsSubmittingProof(true);
    setProofError(null);

    try {
      // 1. Submit proof of fix
      const proofRes = await apiClient.submitProofOfFix(ticket.id, {
        photoDataUri: proofPhotoUri,
        summary: proofSummary.trim()
      });

      if (!proofRes.success) {
        setProofError(proofRes.message || 'Failed to record Proof of Fix.');
        setIsSubmittingProof(false);
        return;
      }

      // 2. Mark Resolved
      const statusRes = await apiClient.updateStatus(ticket.id, {
        status: 'Resolved',
        notes: `Proof of fix verified: ${proofSummary.trim()}`
      });

      if (statusRes.success && statusRes.ticket) {
        setIsProofModalOpen(false);
        onTicketUpdated(statusRes.ticket);
      } else {
        setProofError('Proof recorded, but status update failed.');
      }
    } catch (err: any) {
      setProofError(err.message || 'Error processing resolution proof.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    // If moving to Resolved, enforce Proof of Fix first
    if (newStatus === 'Resolved' && (!ticket.proofOfFix || !ticket.proofOfFix.photoDataUri)) {
      setIsProofModalOpen(true);
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);

    try {
      const res = await apiClient.updateStatus(ticket.id, {
        status: newStatus,
        notes: statusNote.trim() || undefined
      });

      if (res.success && res.ticket) {
        setStatusNote('');
        onTicketUpdated(res.ticket);
      } else {
        setStatusError('Failed to update status');
      }
    } catch (err: any) {
      setStatusError(err.message || 'Error communicating with ticket server');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle assignment
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const res = await apiClient.assignTicket(ticket.id, {
        department: assignDept,
        assignedTo: technicianName.trim() || undefined,
        priority,
        notes: assignNotes.trim() || undefined
      });

      if (res.success && res.ticket) {
        setAssignSuccess(`Assigned to ${assignDept}`);
        onTicketUpdated(res.ticket);
        setTimeout(() => setAssignSuccess(null), 3000);
      } else {
        setAssignError('Failed to assign ticket');
      }
    } catch (err: any) {
      setAssignError(err.message || 'Error saving assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Priority Override
  const handlePriorityOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;

    setIsOverriding(true);
    try {
      const res = await apiClient.overridePriority(ticket.id, overridePriorityVal, overrideReason.trim());
      if (res.success && res.ticket) {
        onTicketUpdated(res.ticket);
        setIsOverrideModalOpen(false);
        setOverrideReason('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to override priority');
    } finally {
      setIsOverriding(false);
    }
  };

  // Handle Add Blocker
  const handleAddBlockerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockerText.trim()) return;

    setIsAddingBlocker(true);
    try {
      const res = await apiClient.addBlocker(ticket.id, blockerText.trim());
      if (res.success && res.ticket) {
        onTicketUpdated(res.ticket);
        setBlockerText('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record blocker');
    } finally {
      setIsAddingBlocker(false);
    }
  };

  // Handle adding private internal note
  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternalNote.trim()) return;

    setIsAddingNote(true);
    setNoteError(null);

    try {
      const res = await apiClient.addInternalNote(ticket.id, newInternalNote.trim());
      if (res.success && res.note) {
        const updatedTicket: Ticket = {
          ...ticket,
          internalNotes: [...(ticket.internalNotes || []), res.note]
        };
        onTicketUpdated(updatedTicket);
        setNewInternalNote('');
      } else {
        setNoteError('Failed to add note');
      }
    } catch (err: any) {
      setNoteError(err.message || 'Error saving note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDuplicateReview = async (action: 'confirm' | 'dismiss') => {
    setIsReviewingDuplicate(true);
    try {
      const res = await apiClient.reviewDuplicate(ticket.id, { action });
      if (res.success && res.ticket) {
        onTicketUpdated(res.ticket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewingDuplicate(false);
    }
  };

  const allowedTransitions = VALID_STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                {ticket.id}
              </span>
              <CategoryBadge category={ticket.category} />
              <StatusBadge status={ticket.status} />
              {ticket.assignment?.priority && (
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  {ticket.assignment.priority} Priority
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {ticket.title}
            </h2>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{ticket.building}</span> • <span>{ticket.location}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Reopened Alert (If student reopened) */}
          {ticket.status === 'Reopened' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <RotateCcw size={15} className="text-amber-700" />
                <span>Student Reported Unsuccessful Repair (Ticket Reopened)</span>
              </div>
              <p className="text-slate-700">
                <strong>Reason:</strong> {ticket.reopenReason || 'Issue recurred after technician resolution.'}
              </p>
              <p className="text-[10px] text-slate-500">
                Reopened by {ticket.reopenedBy} on {ticket.reopenedAt ? new Date(ticket.reopenedAt).toLocaleString() : ''}
              </p>
            </div>
          )}

          {/* Impact-Based Priority Engine Assessment */}
          {ticket.priorityRecommendation && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <AlertOctagon size={14} className="text-blue-600" />
                  <span>Impact-Based Priority Recommendation (Rules Engine)</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-300">
                    Recommended: {ticket.priorityRecommendation.priority}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOverrideModalOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                  >
                    Override
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {ticket.priorityRecommendation.reasons.map((r, idx) => (
                  <div key={idx} className="text-slate-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>

              {ticket.priorityOverride && (
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 mt-2">
                  <span className="font-bold">Staff Override Active: </span>
                  {ticket.priorityOverride.priority} Priority — "{ticket.priorityOverride.reason}" (by {ticket.priorityOverride.overriddenBy})
                </div>
              )}
            </div>
          )}

          {/* Active Operational Blockers */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Operational Blockers &amp; Spare Parts
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                SLA Target: {ticket.slaHoursTarget || 24}h • Deadline: {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleTimeString() : 'N/A'}
              </span>
            </div>

            {ticket.blockers && ticket.blockers.length > 0 ? (
              <div className="space-y-1.5">
                {ticket.blockers.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-semibold">{b.description}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Logged by {b.reportedBy} ({new Date(b.reportedAt).toLocaleTimeString()})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic">No blockers logged. Work progressing under SLA.</p>
            )}

            <form onSubmit={handleAddBlockerSubmit} className="flex gap-2 pt-1">
              <input
                type="text"
                value={blockerText}
                onChange={(e) => setBlockerText(e.target.value)}
                placeholder="Log parts blocker (e.g. Awaiting replacement P-trap seal from vendor)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <button
                type="submit"
                disabled={isAddingBlocker || !blockerText.trim()}
                className="px-3 py-1.5 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-900 cursor-pointer disabled:opacity-50"
              >
                Log Blocker
              </button>
            </form>
          </div>

          {/* Verified Proof of Fix (If already resolved) */}
          {ticket.proofOfFix && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2">
              <div className="flex items-center gap-2 text-emerald-950 font-bold">
                <FileCheck size={16} className="text-emerald-700" />
                <span>Verified Proof of Fix Recorded</span>
              </div>
              <div className="flex items-start gap-4">
                <img
                  src={ticket.proofOfFix.photoDataUri}
                  alt="Proof of Fix"
                  className="w-32 h-24 object-cover rounded-xl border border-emerald-300"
                />
                <div className="space-y-1 text-slate-700">
                  <p className="font-semibold">{ticket.proofOfFix.summary}</p>
                  <p className="text-[10px] text-slate-500">
                    Uploaded by {ticket.proofOfFix.uploadedBy} on {new Date(ticket.proofOfFix.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Transitions Controls */}
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Workflow Status Progression
            </h4>

            {statusError && (
              <p className="text-rose-600 font-semibold">{statusError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Current: <strong>{ticket.status}</strong> → Transition to:</span>
              {allowedTransitions.map((nextSt) => (
                <button
                  key={nextSt}
                  type="button"
                  onClick={() => handleUpdateStatus(nextSt)}
                  disabled={isUpdatingStatus}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs ${
                    nextSt === 'Resolved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-white hover:bg-slate-100 text-blue-900 border border-blue-300'
                  }`}
                >
                  {nextSt === 'Resolved' ? 'Resolve (Requires Proof of Fix)' : nextSt}
                </button>
              ))}
            </div>
          </div>

          {/* Assignment Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Department &amp; Technician Assignment
            </h4>

            {assignSuccess && <p className="text-emerald-700 font-semibold">{assignSuccess}</p>}
            {assignError && <p className="text-rose-600 font-semibold">{assignError}</p>}

            <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Responsible Dept</label>
                <select
                  value={assignDept}
                  onChange={(e) => setAssignDept(e.target.value as Department)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Technician Name</label>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="e.g. Carlos Rivera"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isAssigning ? 'Updating Assignment...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>

          {/* Internal Staff Notes (Separated & Private) */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold">
              <Lock size={13} className="text-amber-700" />
              <span>Private Internal Staff Notes (Inaccessible to Students)</span>
            </div>

            {ticket.internalNotes && ticket.internalNotes.length > 0 ? (
              <div className="space-y-2">
                {ticket.internalNotes.map((n) => (
                  <div key={n.id} className="bg-white p-3 rounded-xl border border-amber-200 text-slate-800">
                    <p className="font-medium">{n.content}</p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {n.authorName} • {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic">No internal notes added yet.</p>
            )}

            <form onSubmit={handleAddInternalNote} className="flex gap-2">
              <input
                type="text"
                value={newInternalNote}
                onChange={(e) => setNewInternalNote(e.target.value)}
                placeholder="Add confidential technician note..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
              />
              <button
                type="submit"
                disabled={isAddingNote || !newInternalNote.trim()}
                className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
              >
                Add Note
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Proof of Fix Upload Modal */}
      {isProofModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileCheck size={18} className="text-emerald-600" />
                <span>Submit Verified Proof of Fix</span>
              </h3>
              <button onClick={() => setIsProofModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {proofError && (
              <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">{proofError}</p>
            )}

            <form onSubmit={handleProofOfFixSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Resolution Photograph <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProofPhoto}
                  required
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                />
                {proofPhotoUri && (
                  <img src={proofPhotoUri} alt="Proof" className="mt-2 w-32 h-24 object-cover rounded-xl border border-slate-300" />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Technician Resolution Summary <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={proofSummary}
                  onChange={(e) => setProofSummary(e.target.value)}
                  placeholder="Detail work performed (e.g. Replaced 1.5-inch P-trap slip joint washer and pressure tested)..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProofModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProof}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {isSubmittingProof ? 'Verifying & Resolving...' : 'Submit Proof & Resolve Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Priority Override Modal */}
      {isOverrideModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">Staff Priority Override</h3>
            <form onSubmit={handlePriorityOverrideSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Override Level</label>
                <select
                  value={overridePriorityVal}
                  onChange={(e) => setOverridePriorityVal(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reason (Mandatory)</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. VIP event scheduled in this hall this afternoon..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOverriding}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
