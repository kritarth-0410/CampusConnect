import React, { useState } from 'react';
import {
  Wrench,
  Zap,
  Sparkles,
  Wifi,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  HardHat,
  MessageSquare,
  Inbox,
  Lock,
  PlusCircle,
  Siren,
  UserCheck,
  Compass,
  Layers,
  HelpCircle
} from 'lucide-react';
import { ComplaintForm } from './ComplaintForm.js';
import { TicketConfirmation } from './TicketConfirmation.js';
import { TicketTracker } from './TicketTracker.js';
import { MyComplaintsList } from './MyComplaintsList.js';
import { StudentProfileSetup } from './StudentProfileSetup.js';
import { EmergencyModal } from './EmergencyModal.js';
import { Ticket, TicketCategory } from '../../shared/types.js';
import { useAuth } from '../../context/AuthContext.js';

interface StudentPortalProps {
  onNavigateToStaff: () => void;
  onOpenAuthModal: (mode?: 'student-login' | 'staff-login' | 'register') => void;
  onOpenDemoGuide: () => void;
  initialMode?: 'report' | 'track' | 'my-complaints' | 'profile';
  initialTicketId?: string;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  onNavigateToStaff,
  onOpenAuthModal,
  onOpenDemoGuide,
  initialMode = 'report',
  initialTicketId = ''
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'report' | 'track' | 'my-complaints' | 'profile'>(
    user ? (initialMode || 'my-complaints') : 'report'
  );
  const [submittedTicket, setSubmittedTicket] = useState<Ticket | null>(null);
  const [ticketToTrack, setTicketToTrack] = useState<string>(initialTicketId);
  const [prefillScenario, setPrefillScenario] = useState<{
    building?: string;
    location?: string;
    description?: string;
  } | undefined>(undefined);

  // Emergency Modal State (Step 1 trigger)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);

  const isProfileIncomplete = user && (!user.profile || !user.profile.isComplete);

  const handleComplaintSubmitted = (ticket: Ticket) => {
    setSubmittedTicket(ticket);
  };

  const handleTrackTicket = (id: string) => {
    setSubmittedTicket(null);
    setTicketToTrack(id);
    setActiveTab('track');
  };

  const handleStartNewComplaint = () => {
    setSubmittedTicket(null);
    setPrefillScenario(undefined);
    setActiveTab('report');
  };

  const handleCategoryCardClick = (cat: TicketCategory) => {
    const examples: Record<TicketCategory, { b: string; l: string; d: string }> = {
      'Plumbing': {
        b: 'Science & Engineering Complex',
        l: '2nd Floor Restroom',
        d: 'Sink faucet is loose and leaking cold water continuously onto the floor.'
      },
      'Electricity': {
        b: 'Main Academic Quad',
        l: 'Lecture Hall 101, Row 4',
        d: 'Power outlet under the desk row has no power and breaker seems tripped.'
      },
      'Cleanliness': {
        b: 'Student Union Center',
        l: 'Food Court Stairwell',
        d: 'Large soda spill on the steps and recycling receptacle is overflowing.'
      },
      'Internet Connectivity': {
        b: 'University Memorial Library',
        l: '3rd Floor Quiet Study Wing',
        d: 'eduroam wireless keeps disconnecting every few minutes for multiple laptops.'
      },
      'Other': {
        b: 'Science & Engineering Complex',
        l: 'Chemistry Lab 304',
        d: 'Broken laboratory fume hood sash cable stuck in open position.'
      }
    };

    setPrefillScenario({
      building: examples[cat].b,
      location: examples[cat].l,
      description: examples[cat].d
    });
    setSubmittedTicket(null);
    setActiveTab('report');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Prominent Emergency Button (Step 1) & Incomplete Profile Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Step 1: Accessible Campus Emergency Alert Button */}
        <button
          type="button"
          onClick={() => {
            if (!user) {
              onOpenAuthModal('student-login');
            } else {
              setIsEmergencyModalOpen(true);
            }
          }}
          className="flex-1 sm:flex-initial px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-sm sm:text-base shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer ring-2 ring-red-400/50 hover:scale-[1.01]"
          title="Report Medical, Security, or Life-Safety Campus Emergency"
        >
          <Siren size={22} className="animate-pulse" />
          <span>Report Campus Emergency (2-Step Dispatch)</span>
        </button>

        {/* Profile Completion Callout */}
        {user && isProfileIncomplete && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-amber-600 shrink-0" />
              <span>Complete your Student Profile for instant emergency autofill:</span>
            </div>
            <button
              onClick={() => setActiveTab('profile')}
              className="font-bold underline text-blue-700 hover:text-blue-900 cursor-pointer shrink-0"
            >
              Setup Profile
            </button>
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-950 text-white overflow-hidden shadow-xl border border-blue-900/40">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative max-w-5xl mx-auto px-6 py-8 sm:py-12 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold backdrop-blur-md">
            <Sparkles size={14} className="text-blue-300" />
            <span>Campus Maintenance Powered by Gemini 3.8 Flash (Complaint Intake Only)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Fixing Campus Facilities with <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">AI-Assisted Triage</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Report maintenance issues in natural words (English, Hindi, or Hinglish). CampusConnect automatically categorizes, asks clarifying questions, assigns certified campus personnel, and tracks verified proof of fix.
          </p>

          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {user && (
              <button
                onClick={() => {
                  setSubmittedTicket(null);
                  setActiveTab('my-complaints');
                }}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                  activeTab === 'my-complaints' && !submittedTicket
                    ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-sm'
                }`}
              >
                <Inbox size={15} />
                <span>My Complaints</span>
              </button>
            )}

            <button
              onClick={() => {
                setSubmittedTicket(null);
                setActiveTab('report');
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                activeTab === 'report' && !submittedTicket
                  ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-sm'
              }`}
            >
              <PlusCircle size={15} />
              <span>Report New Issue</span>
            </button>

            <button
              onClick={() => {
                setSubmittedTicket(null);
                setActiveTab('track');
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                activeTab === 'track'
                  ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-sm'
              }`}
            >
              <Search size={15} />
              <span>Track Ticket</span>
            </button>

            {user && (
              <button
                onClick={() => {
                  setSubmittedTicket(null);
                  setActiveTab('profile');
                }}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 backdrop-blur-sm'
                }`}
              >
                <UserCheck size={15} />
                <span>Student Profile</span>
              </button>
            )}

            {!user && (
              <button
                onClick={() => onOpenAuthModal('student-login')}
                className="px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/20 text-blue-200 border border-blue-400/40 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Lock size={14} />
                <span>Sign In to Save History</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Supported Categories Banner */}
        <div className="relative border-t border-slate-800 bg-slate-950/70 p-4 sm:p-5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Click a category below to test a sample scenario:
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { cat: 'Plumbing' as TicketCategory, icon: Wrench, color: 'text-blue-400', border: 'hover:border-blue-500/40', desc: 'Leaks, faucets, drains, toilets' },
                { cat: 'Electricity' as TicketCategory, icon: Zap, color: 'text-amber-400', border: 'hover:border-amber-500/40', desc: 'Outlets, sparks, lights, breakers' },
                { cat: 'Cleanliness' as TicketCategory, icon: Sparkles, color: 'text-emerald-400', border: 'hover:border-emerald-500/40', desc: 'Spills, trash, sanitation, odors' },
                { cat: 'Internet Connectivity' as TicketCategory, icon: Wifi, color: 'text-indigo-400', border: 'hover:border-indigo-500/40', desc: 'Wi-Fi drops, APs, ethernet, slow LAN' },
                { cat: 'Other' as TicketCategory, icon: Layers, color: 'text-purple-400', border: 'hover:border-purple-500/40', desc: 'Doors, furniture, AC, general' },
              ].map(({ cat, icon: Icon, color, border, desc }) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryCardClick(cat)}
                  className={`p-3 rounded-xl bg-slate-900/80 border border-slate-800 ${border} text-left transition-all hover:scale-[1.02] cursor-pointer group`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={15} className={color} />
                    <span className="font-bold text-xs text-slate-200 group-hover:text-white">
                      {cat}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {submittedTicket ? (
          <TicketConfirmation
            ticket={submittedTicket}
            onTrackTicket={handleTrackTicket}
            onNewComplaint={handleStartNewComplaint}
          />
        ) : activeTab === 'profile' && user ? (
          <StudentProfileSetup
            onSaved={() => {
              setActiveTab('my-complaints');
            }}
          />
        ) : activeTab === 'my-complaints' && user ? (
          <MyComplaintsList
            onSelectTicket={handleTrackTicket}
            onNewComplaint={handleStartNewComplaint}
          />
        ) : activeTab === 'report' ? (
          <ComplaintForm
            onSuccess={handleComplaintSubmitted}
            onNavigateToTrack={handleTrackTicket}
            prefillData={prefillScenario}
          />
        ) : (
          <TicketTracker
            initialTicketId={ticketToTrack}
            onNavigateToNewComplaint={handleStartNewComplaint}
          />
        )}
      </div>

      {/* Emergency Reporting Modal (Step 1 -> Step 2 Flow) */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />
    </div>
  );
};
