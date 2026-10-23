import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Siren,
  PhoneCall,
  MapPin,
  Compass,
  CheckCircle2,
  X,
  Loader2,
  Clock,
  ShieldAlert,
  Edit2,
  Radio,
  ExternalLink
} from 'lucide-react';
import { EmergencyIncident } from '../../shared/types.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertSubmitted?: (incident: EmergencyIncident) => void;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose, onAlertSubmitted }) => {
  const { user } = useAuth();
  const profile = user?.profile;

  // Emergency Type Selection
  const [emergencyType, setEmergencyType] = useState<'medical' | 'security' | 'general'>('medical');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Editable Location Fields (Prefilled from Profile)
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  // GPS Coordinates
  const [gps, setGps] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  } | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<'locating' | 'acquired' | 'denied' | 'unavailable'>('locating');

  // Submission & Incident State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeIncident, setActiveIncident] = useState<EmergencyIncident | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill from profile on open
  useEffect(() => {
    if (isOpen) {
      setBuilding(profile?.hostelOrBlock || 'Science & Engineering Complex');
      setFloor(profile?.floor || '2nd Floor');
      setRoom(profile?.roomNumber || 'Room 204');
      setAdditionalNotes('');
      setSubmitError(null);
      setActiveIncident(null);

      // Attempt to acquire high-accuracy GPS coordinates without blocking submission
      if (navigator.geolocation) {
        setGpsStatus('locating');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGps({
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: Math.round(pos.coords.accuracy),
              timestamp: new Date().toISOString()
            });
            setGpsStatus('acquired');
          },
          (err) => {
            console.warn('[Emergency GPS] Geolocation permission or signal unavailable:', err.message);
            setGpsStatus('denied');
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        setGpsStatus('unavailable');
      }
    }
  }, [isOpen, profile]);

  // Polling for live status updates if an incident is active
  useEffect(() => {
    let timer: any = null;
    if (activeIncident && activeIncident.status !== 'Resolved') {
      timer = setInterval(() => {
        apiClient
          .getEmergencyIncidentById(activeIncident.id)
          .then((res) => {
            if (res.success && res.incident) {
              setActiveIncident(res.incident);
            }
          })
          .catch(() => {});
      }, 4000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeIncident]);

  if (!isOpen) return null;

  const handleConfirmEmergency = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiClient.submitEmergency({
        emergencyType,
        building: building.trim(),
        floor: floor.trim() || undefined,
        room: room.trim() || undefined,
        gps,
        notes: additionalNotes.trim() || undefined
      });

      if (res.success && res.incident) {
        setActiveIncident(res.incident);
        if (onAlertSubmitted) onAlertSubmitted(res.incident);
      } else {
        setSubmitError(res.error || 'Failed to dispatch emergency alert. Please call ext. 4444 or 911 immediately.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error transmitting alert. Please call emergency services directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border-2 border-rose-500 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Urgent Header Banner */}
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse">
              <Siren size={28} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-rose-950/40 px-2 py-0.5 rounded text-rose-100 border border-rose-300/30">
                CAMPUS EMERGENCY PROTOCOL
              </span>
              <h2 id="emergency-modal-title" className="text-xl font-black text-white leading-tight">
                {activeIncident ? `Alert Dispatched (${activeIncident.id})` : 'Confirm Campus Emergency'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/30 text-white transition-colors cursor-pointer"
            aria-label="Close emergency modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Immediate Danger Advisory */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold">
            <PhoneCall size={14} className="text-amber-700 shrink-0" />
            <span>Immediate life threat? Call National Emergency Desk:</span>
          </div>
          <span className="font-mono font-bold bg-amber-200/70 px-2 py-0.5 rounded text-amber-950">
            911 / 112 / ext. 4444
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {activeIncident ? (
            /* ACTIVE INCIDENT LIVE TRACKER */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Incident Reference</span>
                  <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {activeIncident.id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Dispatch Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      activeIncident.status === 'Acknowledged' || activeIncident.status === 'Responding'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : activeIncident.status === 'Escalated'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                    }`}
                  >
                    <Radio size={12} className={activeIncident.status === 'Responding' ? 'animate-ping' : ''} />
                    <span>{activeIncident.status}</span>
                  </span>
                </div>

                {activeIncident.acknowledgedByName && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    <span className="font-bold">Responder En Route: </span>
                    {activeIncident.acknowledgedByName} ({activeIncident.assignedResponderZone})
                  </div>
                )}
              </div>

              {/* Notification Delivery Breakdown */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Notification Transmissions
                </h4>
                {activeIncident.notificationAttempts.map((notif) => (
                  <div key={notif.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                    <div>
                      <span className="font-semibold text-slate-800">{notif.channel}</span>
                      <p className="text-[11px] text-slate-500">{notif.recipient}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {notif.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Live Timeline</h4>
                <div className="space-y-2">
                  {activeIncident.timeline.map((entry, idx) => (
                    <div key={idx} className="text-xs flex items-start gap-2">
                      <Clock size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800">{entry.status}</span> •{' '}
                        <span className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <p className="text-slate-600 text-[11px]">{entry.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-md"
                >
                  Close &amp; Monitor from Portal
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: CONFIRMATION SCREEN (2 PRIMARY STEPS) */
            <div className="space-y-4">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Select Emergency Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  1. Select Emergency Type
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'medical', label: 'Medical Emergency', desc: 'Injury, fainting, asthma', color: 'border-rose-500 bg-rose-50 text-rose-900' },
                    { id: 'security', label: 'Campus Security', desc: 'Intrusion, violence, threat', color: 'border-blue-500 bg-blue-50 text-blue-900' },
                    { id: 'general', label: 'General / Fire', desc: 'Smoke, gas, hazard', color: 'border-amber-500 bg-amber-50 text-amber-900' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEmergencyType(t.id as any)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        emergencyType === t.id
                          ? `${t.color} font-bold shadow-xs scale-[1.02]`
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reporting Student Verified Details (Auto-prefilled) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    2. Reporting Student Details (Saved Profile)
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={12} /> Auto-Attached
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Name &amp; Student ID</span>
                    <span className="font-semibold text-slate-800">
                      {user?.name || 'Student'} {profile?.enrollmentNumber ? `(${profile.enrollmentNumber})` : ''}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Registered Phone</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {profile?.mobileNumber || 'Not in profile'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location Confirmation with Quick Edit Option */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <MapPin size={13} className="text-rose-600" />
                    <span>Location for Emergency Dispatch</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsEditingLocation(!isEditingLocation)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={11} />
                    <span>{isEditingLocation ? 'Done' : 'Change Location'}</span>
                  </button>
                </div>

                {isEditingLocation ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder="Building name"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                    <input
                      type="text"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="Floor (e.g. 2nd Floor)"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                    <input
                      type="text"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      placeholder="Room (e.g. 204)"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                ) : (
                  <div className="text-xs font-medium text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
                    {building || 'Campus Grounds'} {floor ? `• ${floor}` : ''} {room ? `• ${room}` : ''}
                  </div>
                )}

                {/* GPS Status */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Compass size={13} className={gps ? 'text-emerald-600' : 'text-slate-400'} />
                  {gps ? (
                    <span className="font-mono text-emerald-700">
                      GPS Attached: {gps.latitude}, {gps.longitude} (±{gps.accuracy}m)
                    </span>
                  ) : gpsStatus === 'locating' ? (
                    <span className="text-slate-500">Acquiring current GPS coordinates...</span>
                  ) : (
                    <span className="text-slate-400">GPS not shared (dispatch relies on building and room).</span>
                  )}
                </div>
              </div>

              {/* Optional Brief Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Optional Brief Symptom or Condition Note
                </label>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="e.g. Difficulty breathing, conscious, with roommate"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Confirmation Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmEmergency}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Transmitting Alert...</span>
                    </>
                  ) : (
                    <>
                      <Siren size={18} />
                      <span>Confirm Emergency Alert Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
