import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  MapPin,
  User,
  Shield,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowRight,
  HardHat,
  MessageSquare,
  Lock,
  Camera,
  RotateCcw,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { Ticket, TicketStatus, TICKET_STATUSES } from '../../shared/types.js';
import { CategoryBadge } from '../common/CategoryBadge.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface TicketTrackerProps {
  initialTicketId?: string;
  onNavigateToNewComplaint: () => void;
}

export const TicketTracker: React.FC<TicketTrackerProps> = ({
  initialTicketId = '',
  onNavigateToNewComplaint
}) => {
  const { user } = useAuth();
  const [ticketIdInput, setTicketIdInput] = useState(initialTicketId);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reopen Modal State
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopenSuccess, setReopenSuccess] = useState<string | null>(null);

  const fetchTicket = async (idToFetch: string) => {
    if (!idToFetch.trim()) {
      setErrorMessage('Please enter a ticket ID (e.g. CC-1001).');
      return;
    }

    if (!user) {
      setErrorMessage('Please sign in to track maintenance tickets.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setReopenSuccess(null);

    try {
      const res = await apiClient.getTicketById(idToFetch.trim());
      if (res.success && res.ticket) {
        setCurrentTicket(res.ticket);
        setTicketIdInput(res.ticket.id);
      } else {
        setErrorMessage(res.error || `No ticket found with ID ${idToFetch}`);
        setCurrentTicket(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error looking up ticket.');
      setCurrentTicket(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialTicketId) {
      fetchTicket(initialTicketId);
    }
  }, [initialTicketId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTicket(ticketIdInput);
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicket) return;
    if (!reopenReason.trim()) {
      setReopenError('Please describe why the repair was unsuccessful.');
      return;
    }

    setIsReopening(true);
    setReopenError(null);

    try {
      const res = await apiClient.reopenTicket(currentTicket.id, reopenReason.trim());
      if (res.success && res.ticket) {
        setCurrentTicket(res.ticket);
        setIsReopenModalOpen(false);
        setReopenReason('');
        setReopenSuccess('Ticket reopened and flagged for supervisor review.');
      } else {
        setReopenError(res.error || 'Failed to reopen ticket.');
      }
    } catch (err: any) {
      setReopenError(err.message || 'Error communicating with server.');
    } finally {
      setIsReopening(false);
    }
  };

  const getStepIndex = (status: TicketStatus): number => {
    return TICKET_STATUSES.indexOf(status);
  };

  const currentStepIndex = currentTicket ? getStepIndex(currentTicket.status) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Lookup Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center space-y-2 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Track Maintenance Complaint Progress
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter your unique Ticket ID to see real-time triage, technician assignment, blockers, and verified proof of fix.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={ticketIdInput}
                onChange={(e) => setTicketIdInput(e.target.value)}
                placeholder="Enter Ticket ID (e.g. CC-1001, CC-1002)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase font-mono text-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !ticketIdInput.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>Lookup Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="max-w-xl mx-auto mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-medium">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {reopenSuccess && (
          <div className="max-w-xl mx-auto mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{reopenSuccess}</span>
          </div>
        )}
      </div>

      {/* Ticket Details View */}
      {currentTicket && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6 p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentTicket.id}
                </span>
                <CategoryBadge category={currentTicket.category} />
                <StatusBadge status={currentTicket.status} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {currentTicket.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{currentTicket.building}</span> • <span>{currentTicket.location}</span>
              </p>
            </div>

            {/* Reopen Action for Resolved Tickets */}
            {currentTicket.status === 'Resolved' && (
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RotateCcw size={14} />
                <span>Report Unsuccessful Repair / Reopen</span>
              </button>
            )}
          </div>

          {/* Workflow Progress Bar */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Resolution Milestones
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved'].map((st, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentTicket.status === st;

                return (
                  <div
                    key={st}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : isPassed
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isPassed ? (
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      ) : (
                        <Clock size={13} className="text-slate-400 shrink-0" />
                      )}
                      <span className="text-[11px] font-semibold">{st}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proof of Fix Evidence (If available) */}
          {currentTicket.proofOfFix && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-emerald-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  Verified Proof of Fix by Campus Staff
                </h4>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <img
                  src={currentTicket.proofOfFix.photoDataUri}
                  alt="Proof of Fix Resolution"
                  className="w-48 h-36 object-cover rounded-xl border border-emerald-300 shadow-xs"
                />
                <div className="text-xs space-y-2 text-emerald-900">
                  <p className="font-medium bg-white p-3 rounded-xl border border-emerald-200">
                    <strong className="block text-emerald-950 mb-0.5">Technician Summary:</strong>
                    {currentTicket.proofOfFix.summary}
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Verified and closed by <strong>{currentTicket.proofOfFix.uploadedBy}</strong> on{' '}
                    {new Date(currentTicket.proofOfFix.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Blockers Tracker (If any reported) */}
          {currentTicket.blockers && currentTicket.blockers.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Active Operational Blocker Reported</span>
              </div>
              {currentTicket.blockers.map((blk) => (
                <div key={blk.id} className="text-xs text-amber-800 bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="font-semibold">{blk.description}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Logged by {blk.reportedBy} on {new Date(blk.reportedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Issue Description & History */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 block font-semibold">Original Complaint Description</span>
              <p className="text-slate-800 font-medium leading-relaxed">{currentTicket.description}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 block font-semibold">Responsible Department Assignment</span>
              <p className="text-slate-800 font-medium">
                {currentTicket.assignment?.department || 'Awaiting supervisor triage'}
              </p>
              {currentTicket.assignment?.assignedTo && (
                <p className="text-slate-600 text-[11px]">
                  Technician: <strong>{currentTicket.assignment.assignedTo}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reopen Ticket Modal */}
      {isReopenModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <RotateCcw size={16} className="text-amber-600" />
                <span>Report Failed Repair &amp; Reopen</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {reopenError && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {reopenError}
              </p>
            )}

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Why is the repair incomplete or recurring? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. Pipe is still dripping water when faucet is turned on..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  disabled={isReopening}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReopening}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isReopening ? 'Submitting...' : 'Confirm Reopening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
