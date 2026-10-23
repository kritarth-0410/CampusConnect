import React, { useState } from 'react';
import {
  X,
  PlaySquare,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  HardHat,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Wrench,
  Lock
} from 'lucide-react';
import { AppView } from '../common/Header.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface DemoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView, ticketId?: string) => void;
}

interface DemoStep {
  stepNumber: number;
  title: string;
  actor: 'Student' | 'Gemini AI' | 'Staff' | 'System';
  description: string;
  actionText: string;
  runAction: () => void;
}

export const DemoWalkthroughModal: React.FC<DemoWalkthroughModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const { refreshUser } = useAuth();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [demoTicketId, setDemoTicketId] = useState<string>('CC-1001');
  const [isAutomating, setIsAutomating] = useState(false);
  const [autoStatusMessage, setAutoStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const markStepDone = (stepNum: number) => {
    setCompletedSteps((prev) => (prev.includes(stepNum) ? prev : [...prev, stepNum]));
  };

  // Automated 7-Step Hackathon Walkthrough runner (Authenticates against real server!)
  const handleRunFullDemo = async () => {
    setIsAutomating(true);
    setAutoStatusMessage('Step 1/7: Authenticating as student Alex Chen...');

    try {
      // 1. Authenticate as student
      await apiClient.login({ email: 'alex.chen@campus.edu', password: 'StudentPass2026!' });
      await refreshUser();

      // 2. Analyze with Gemini
      setAutoStatusMessage('Step 2/7: Running Gemini AI triage & missing detail inspection...');
      const analyzeRes = await apiClient.analyzeComplaint({
        description: 'Sink in the washroom is loose and leaking dirty water on the tiles',
        building: 'Science & Engineering Complex',
        location: '2nd Floor Restroom'
      });

      // 3. Submit with completed answers
      setAutoStatusMessage('Step 3/7: Submitting completed complaint with student clarification answers...');
      const submitRes = await apiClient.submitComplaint({
        description: 'Sink in the washroom is loose and leaking dirty water on the tiles.\n[Clarification]: Restroom opposite Room 204. Active drip onto floor.',
        building: 'Science & Engineering Complex',
        location: 'West Wing Restroom 2nd Floor',
        category: 'Plumbing',
        categorySource: 'ai_suggested',
        aiAnalysis: analyzeRes.analysis,
        studentFollowUpAnswers: {
          'Specific room/floor': 'Opposite Room 204',
          'Flooding status': 'Dripping steadily, slip hazard'
        }
      });

      if (!submitRes.ticket) throw new Error('Submission failed');
      const newId = submitRes.ticket.id;
      setDemoTicketId(newId);

      // 4. Staff Review: Authenticate as Staff
      setAutoStatusMessage(`Step 4/7: Authenticating as Triage Supervisor Sarah to inspect ${newId}...`);
      await apiClient.login({ email: 'sarah.supervisor@campus.edu', password: 'StaffPass2026!' });
      await refreshUser();
      await new Promise((r) => setTimeout(r, 1200));

      // 5. Staff Assigns
      setAutoStatusMessage(`Step 5/7: Staff assigns ${newId} to Plumbing Maintenance Department.`);
      await apiClient.assignTicket(newId, {
        department: 'Plumbing Maintenance Department',
        assignedTo: 'Carlos Rivera (Master Plumber)',
        priority: 'High',
        notes: 'Dispatched with emergency replacement seals.'
      });

      // Add confidential internal note
      await apiClient.addInternalNote(newId, 'Verified leak rate. Isolation valve closed before fixture removal.');

      // 6. Staff Updates to In Progress then Resolved
      setAutoStatusMessage(`Step 6/7: Technician updates status to "In Progress" then "Resolved"...`);
      await apiClient.updateStatus(newId, {
        status: 'In Progress',
        notes: 'Technician on site, water isolation valve closed.'
      });

      await new Promise((r) => setTimeout(r, 1200));
      await apiClient.updateStatus(newId, {
        status: 'Resolved',
        notes: 'Drain pipe fitting replaced and floor dried. Issue fully resolved.'
      });

      // 7. Student checks progress timeline
      setAutoStatusMessage(`Step 7/7: Switching back to student account to view progress timeline...`);
      await apiClient.login({ email: 'alex.chen@campus.edu', password: 'StudentPass2026!' });
      await refreshUser();

      setCompletedSteps([1, 2, 3, 4, 5, 6, 7]);
      setAutoStatusMessage(`Step 7/7: Complete! Ticket ${newId} is resolved. Loading progress timeline...`);
      await new Promise((r) => setTimeout(r, 1500));

      setIsAutomating(false);
      onClose();
      onNavigate('track', newId);
    } catch (err: any) {
      setAutoStatusMessage(`Demo encountered an issue: ${err.message}`);
      setIsAutomating(false);
    }
  };

  const steps: DemoStep[] = [
    {
      stepNumber: 1,
      title: 'Student Submits Incomplete Complaint',
      actor: 'Student',
      description: 'A student starts a complaint with informal, brief text ("faucet dripping in north hall").',
      actionText: 'Open Student Form',
      runAction: () => {
        markStepDone(1);
        onClose();
        onNavigate('student');
      }
    },
    {
      stepNumber: 2,
      title: 'Gemini AI Identifies Missing Details',
      actor: 'Gemini AI',
      description: 'Gemini classifies category (Plumbing), scores confidence, and asks follow-ups ("What room number?", "Is it actively flooding?").',
      actionText: 'Test in Student Portal',
      runAction: () => {
        markStepDone(2);
        onClose();
        onNavigate('student');
      }
    },
    {
      stepNumber: 3,
      title: 'Student Answers & Gets Ticket ID',
      actor: 'Student',
      description: 'Student answers the follow-up questions, submits, and receives unique Ticket ID (e.g. CC-1005).',
      actionText: 'View Confirmation',
      runAction: () => {
        markStepDone(3);
        onClose();
        onNavigate('student');
      }
    },
    {
      stepNumber: 4,
      title: 'Staff Sees Ticket & Duplicate Warnings',
      actor: 'Staff',
      description: 'Facilities staff sees ticket on dashboard with possible duplicate warnings comparing similar active complaints.',
      actionText: 'Go to Staff Dashboard',
      runAction: () => {
        markStepDone(4);
        onClose();
        onNavigate('staff');
      }
    },
    {
      stepNumber: 5,
      title: 'Staff Assigns to Department',
      actor: 'Staff',
      description: 'Staff selects responsible department (e.g. Plumbing Maintenance) and technician with priority level.',
      actionText: 'Open Staff Triage',
      runAction: () => {
        markStepDone(5);
        onClose();
        onNavigate('staff');
      }
    },
    {
      stepNumber: 6,
      title: 'Status Updated Through Workflow',
      actor: 'Staff',
      description: 'Staff updates ticket status through validated transitions: Submitted → Under Review → Assigned → In Progress → Resolved.',
      actionText: 'Test in Staff Board',
      runAction: () => {
        markStepDone(6);
        onClose();
        onNavigate('staff');
      }
    },
    {
      stepNumber: 7,
      title: 'Student Looks Up Progress Timeline',
      actor: 'Student',
      description: 'Student enters Ticket ID in tracker and views complete status history with timestamps and technician remarks.',
      actionText: `Track ${demoTicketId}`,
      runAction: () => {
        markStepDone(7);
        onClose();
        onNavigate('track', demoTicketId);
      }
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-guide-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-purple-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <PlaySquare size={14} />
              <span>Interactive Evaluation Script</span>
            </div>
            <h3 id="demo-guide-title" className="text-2xl font-bold text-white">
              Required 7-Step End-to-End Demo Walkthrough
            </h3>
            <p className="text-purple-100 text-xs sm:text-sm mt-1 max-w-xl">
              Demonstrates the complete lifecycle: student submission, Gemini AI triage, follow-up clarification, duplicate review, staff dispatch, internal notes, and student timeline lookup.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close walkthrough guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1-Click Auto Demo Banner */}
        <div className="p-4 bg-purple-50 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-purple-950 block">Quick 1-Click Demonstration</span>
            <p className="text-purple-700 text-[11px] mt-0.5">
              Automatically creates a complaint, runs Gemini triage, resolves it via staff workflow, and loads the student timeline.
            </p>
          </div>

          <button
            onClick={handleRunFullDemo}
            disabled={isAutomating}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 justify-center"
          >
            <Sparkles size={14} />
            <span>{isAutomating ? 'Running Demo...' : 'Run Automated 7-Step Demo'}</span>
          </button>
        </div>

        {autoStatusMessage && (
          <div className="px-6 py-2 bg-indigo-100/70 border-b border-indigo-200 text-indigo-900 text-xs font-medium flex items-center gap-2" role="status">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span>{autoStatusMessage}</span>
          </div>
        )}

        {/* 7 Interactive Steps Checklist */}
        <div className="p-6 overflow-y-auto space-y-3">
          {steps.map((st) => {
            const isDone = completedSteps.includes(st.stepNumber);
            return (
              <div
                key={st.stepNumber}
                className={`p-4 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    {isDone ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                        {st.stepNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{st.title}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {st.actor}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      {st.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={st.runAction}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0 self-end sm:self-center"
                >
                  <span>{st.actionText}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Completed: <strong>{completedSteps.length} of 7</strong> demo steps
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
