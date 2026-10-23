import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  HardHat,
  RefreshCw,
  AlertTriangle,
  Building,
  User,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Inbox,
  Lock,
  LogIn,
  Siren,
  Radio,
  Layers,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  DEPARTMENTS,
  Department,
  EmergencyIncident,
  IncidentCluster,
  RepeatOffenderAsset
} from '../../shared/types.js';
import { CategoryBadge } from '../common/CategoryBadge.js';
import { StatusBadge } from '../common/StatusBadge.js';
import { StaffMetrics } from './StaffMetrics.js';
import { TicketDetailModal } from './TicketDetailModal.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface StaffDashboardProps {
  onOpenDemoGuide: () => void;
  onOpenAuthModal?: () => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  onOpenDemoGuide,
  onOpenAuthModal
}) => {
  const { user } = useAuth();

  // Active view tab: 'tickets' | 'emergencies' | 'clusters' | 'repeat-offenders'
  const [activeTab, setActiveTab] = useState<'tickets' | 'emergencies' | 'clusters' | 'repeat-offenders'>('tickets');

  // Data state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyIncident[]>([]);
  const [clusters, setClusters] = useState<IncidentCluster[]>([]);
  const [repeatOffenders, setRepeatOffenders] = useState<RepeatOffenderAsset[]>([]);

  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    underReview: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    byCategory: {
      'Plumbing': 0,
      'Electricity': 0,
      'Cleanliness': 0,
      'Internet Connectivity': 0,
      'Other': 0
    }
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Load tickets with filters
  const fetchTickets = async () => {
    if (!user || (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'responder')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [ticketRes, emgRes, clusterRes, repeatRes] = await Promise.all([
        apiClient.getTickets({
          query: searchQuery.trim() || undefined,
          status: statusFilter,
          category: categoryFilter,
          department: departmentFilter,
          building: buildingFilter
        }),
        apiClient.getEmergencyIncidents().catch(() => ({ success: false, incidents: [] })),
        apiClient.getClusters().catch(() => ({ success: false, clusters: [] })),
        apiClient.getRepeatOffenders().catch(() => ({ success: false, repeatOffenders: [] }))
      ]);

      if (ticketRes.success) {
        setTickets(ticketRes.tickets as Ticket[]);
        setStats(ticketRes.stats as any);
      }
      if (emgRes.success && emgRes.incidents) {
        setEmergencies(emgRes.incidents);
      }
      if (clusterRes.success && clusterRes.clusters) {
        setClusters(clusterRes.clusters);
      }
      if (repeatRes.success && repeatRes.repeatOffenders) {
        setRepeatOffenders(repeatRes.repeatOffenders);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with ticket server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user, statusFilter, categoryFilter, departmentFilter, buildingFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleTicketUpdated = (updatedTicket: Ticket) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
    );
    setSelectedTicket(updatedTicket);
    fetchTickets();
  };

  // Emergency Responder Quick Actions
  const handleAcknowledgeEmergency = async (id: string) => {
    try {
      const res = await apiClient.acknowledgeEmergency(id, 'Responder verified alert and dispatched personnel');
      if (res.success && res.incident) {
        setEmergencies((prev) => prev.map((e) => (e.id === id ? res.incident! : e)));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert');
    }
  };

  const handleUpdateEmergencyStatus = async (id: string, status: 'Responding' | 'Escalated' | 'Resolved') => {
    try {
      const res = await apiClient.updateEmergencyStatus(id, status);
      if (res.success && res.incident) {
        setEmergencies((prev) => prev.map((e) => (e.id === id ? res.incident! : e)));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update alert status');
    }
  };

  // Guard: If not staff, admin, or responder, render authorization barrier
  if (!user || (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'responder')) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-md p-8 text-center space-y-4 text-slate-800">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-inner">
          <Lock size={28} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Protected Facilities Staff Area</h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Access to campus dispatch operations, technician assignment, duplicate review, and emergency responder dispatch is restricted to authorized campus facilities personnel.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onOpenAuthModal && onOpenAuthModal()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn size={15} />
            <span>Sign In to Staff / Responder Account</span>
          </button>
        </div>
      </div>
    );
  }

  const activeEmergencies = emergencies.filter((e) => e.status !== 'Resolved');

  return (
    <div className="space-y-6 pb-12">
      {/* Active Emergencies Banner (Prominent for Responders & Staff) */}
      {activeEmergencies.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-xl border-2 border-red-500 animate-in fade-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Siren size={24} className="animate-pulse" />
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                ACTIVE CAMPUS EMERGENCY ALERTS ({activeEmergencies.length})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('emergencies')}
              className="text-xs font-bold underline bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Open Responder Board
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeEmergencies.slice(0, 2).map((emg) => (
              <div key={emg.id} className="p-3.5 rounded-2xl bg-black/25 backdrop-blur-xs border border-white/20 text-xs flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold bg-white text-rose-900 px-2 py-0.5 rounded text-[11px]">
                      {emg.id} • {emg.emergencyType.toUpperCase()}
                    </span>
                    <span className="text-[11px] font-bold text-amber-200 flex items-center gap-1">
                      <Radio size={12} className="animate-ping" />
                      {emg.status}
                    </span>
                  </div>
                  <p className="font-semibold text-white">
                    {emg.studentName} • {emg.building} {emg.floor ? `(${emg.floor})` : ''}
                  </p>
                  <p className="text-rose-100 text-[11px]">{emg.description || 'Medical/Security alert confirmed'}</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {emg.status === 'Awaiting acknowledgement' && (
                    <button
                      onClick={() => handleAcknowledgeEmergency(emg.id)}
                      className="px-3 py-1 rounded-lg font-bold bg-white text-rose-900 hover:bg-rose-100 cursor-pointer shadow-xs"
                    >
                      Acknowledge Alert
                    </button>
                  )}
                  {emg.status === 'Acknowledged' && (
                    <button
                      onClick={() => handleUpdateEmergencyStatus(emg.id, 'Responding')}
                      className="px-3 py-1 rounded-lg font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-xs"
                    >
                      Mark Responding
                    </button>
                  )}
                  {emg.status === 'Responding' && (
                    <button
                      onClick={() => handleUpdateEmergencyStatus(emg.id, 'Resolved')}
                      className="px-3 py-1 rounded-lg font-bold bg-white text-slate-900 hover:bg-slate-100 cursor-pointer shadow-xs"
                    >
                      Clear &amp; Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Banner and Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <HardHat className="text-amber-500 w-6 h-6" />
              <span>Facilities Operations &amp; Dispatch Board</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong>{user.name}</strong> • Role:{' '}
            <span className="uppercase font-bold text-slate-700">{user.role}</span> (
            {user.department || 'All Campus Facilities'})
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'tickets' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Maintenance Tickets ({tickets.length})
          </button>

          <button
            onClick={() => setActiveTab('emergencies')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'emergencies' ? 'bg-rose-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Siren size={13} />
            <span>Emergencies ({emergencies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('clusters')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'clusters' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={13} />
            <span>Clusters ({clusters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('repeat-offenders')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'repeat-offenders' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench size={13} />
            <span>Repeat Assets</span>
          </button>
        </div>
      </div>

      {/* Real Metrics Cards */}
      <StaffMetrics stats={stats} />

      {/* RECURRING-ISSUE CLUSTERS VIEW (>= 10 complaints in 2h) */}
      {activeTab === 'clusters' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="text-indigo-600" />
                <span>Recurring-Issue Clusters (10+ Complaints in 2-Hour Window)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Automatically identifies systemic building outages based on rolling 2-hour complaint density.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              {clusters.length} Cluster(s) Active
            </span>
          </div>

          {clusters.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              No systemic clusters currently meeting the 10-complaint / 2-hour threshold. Individual tickets progressing normally.
            </p>
          ) : (
            <div className="space-y-3">
              {clusters.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded">
                        {c.id} • {c.priority} PRIORITY
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{c.title}</h4>
                      <p className="text-xs text-indigo-900">{c.priorityReason}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-xl border border-slate-200">
                      Linked Tickets: {c.ticketCount}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Ticket IDs:</span>
                    {c.ticketIds.map((tid) => (
                      <span key={tid} className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                        {tid}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                    <button
                      onClick={async () => {
                        const note = prompt('Reason for dismissing cluster:');
                        if (note) {
                          await apiClient.reviewCluster(c.id, 'dismiss', note);
                          fetchTickets();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 cursor-pointer"
                    >
                      Dismiss Grouping
                    </button>

                    <button
                      onClick={async () => {
                        await apiClient.reviewCluster(c.id, 'resolve', 'Shared infrastructure root cause repaired');
                        fetchTickets();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
                    >
                      Resolve Cluster
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REPEAT-OFFENDER ASSETS VIEW */}
      {activeTab === 'repeat-offenders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="text-amber-600" />
              <span>Repeat-Offender Asset Detector</span>
            </h3>
            <p className="text-xs text-slate-500">
              Identifies campus fixtures and assets with chronic failures in 30-day windows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {repeatOffenders.map((asset) => (
              <div key={asset.assetId} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                    {asset.assetId}
                  </span>
                  <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    {asset.recurrenceCount30Days} Failures / 30d
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">{asset.assetName}</h4>
                <p className="text-slate-600">{asset.building} • {asset.roomOrArea}</p>

                <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-amber-950">
                  <span className="font-bold block text-[10px] text-amber-800 uppercase tracking-wider mb-0.5">
                    Unverified Root Cause Hypothesis:
                  </span>
                  {asset.unverifiedRootCauseHypothesis}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMERGENCY RESPONDER BOARD VIEW */}
      {activeTab === 'emergencies' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Siren className="text-red-600" />
              <span>Campus Emergency Dispatch Log</span>
            </h3>
            <p className="text-xs text-slate-500">
              Dedicated responder view with delivery tracking and responder acknowledgement protocols.
            </p>
          </div>

          {emergencies.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No emergency incidents recorded.</p>
          ) : (
            <div className="space-y-3">
              {emergencies.map((emg) => (
                <div key={emg.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded">
                        {emg.id}
                      </span>
                      <span className="font-bold text-slate-900 ml-2">{emg.studentName}</span>
                      <span className="text-slate-500 ml-1">({emg.mobileNumber})</span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        emg.status === 'Resolved'
                          ? 'bg-slate-200 text-slate-700'
                          : emg.status === 'Responding' || emg.status === 'Acknowledged'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                      }`}
                    >
                      {emg.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Location</span>
                      <span className="font-semibold text-slate-800">{emg.building} • {emg.room || 'General Area'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Type &amp; Symptom</span>
                      <span className="font-semibold text-slate-800">{emg.emergencyType.toUpperCase()}: {emg.description || 'Alert confirmed'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">GPS Coordinates</span>
                      <span className="font-mono text-slate-800">
                        {emg.gps ? `${emg.gps.latitude}, ${emg.gps.longitude} (±${emg.gps.accuracy}m)` : 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {emg.status === 'Awaiting acknowledgement' && (
                      <button
                        onClick={() => handleAcknowledgeEmergency(emg.id)}
                        className="px-4 py-1.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
                      >
                        Acknowledge Alert
                      </button>
                    )}
                    {emg.status === 'Acknowledged' && (
                      <button
                        onClick={() => handleUpdateEmergencyStatus(emg.id, 'Responding')}
                        className="px-4 py-1.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                      >
                        Mark Responding
                      </button>
                    )}
                    {emg.status === 'Responding' && (
                      <button
                        onClick={() => handleUpdateEmergencyStatus(emg.id, 'Resolved')}
                        className="px-4 py-1.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TICKETS MAIN LIST VIEW */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <form onSubmit={handleSearchSubmit} className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, building, room..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </form>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="ALL">All Categories</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={fetchTickets}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh List</span>
              </button>
            </div>
          </div>

          {/* Ticket Table */}
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">
              No complaints match the selected filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Ticket ID</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Problem &amp; Location</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">{t.id}</td>
                      <td className="py-3 px-3"><CategoryBadge category={t.category} /></td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{t.title}</div>
                        <div className="text-slate-500 text-[11px]">{t.building} • {t.location}</div>
                      </td>
                      <td className="py-3 px-3"><StatusBadge status={t.status} /></td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.assignment?.priority === 'Emergency' || t.priorityRecommendation?.priority === 'Emergency'
                            ? 'bg-rose-100 text-rose-800'
                            : t.assignment?.priority === 'High' || t.priorityRecommendation?.priority === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {t.assignment?.priority || t.priorityRecommendation?.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(t);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold text-[11px] hover:bg-slate-800 cursor-pointer"
                        >
                          Details &amp; Action
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onTicketUpdated={handleTicketUpdated}
          onNavigateToTicket={() => {}}
        />
      )}
    </div>
  );
};
