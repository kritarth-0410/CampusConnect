import React, { useState, useEffect } from 'react';
import {
  User,
  GraduationCap,
  Phone,
  Mail,
  Building,
  Home,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  ShieldCheck,
  HeartHandshake
} from 'lucide-react';
import { StudentProfile } from '../../shared/types.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface StudentProfileSetupProps {
  onSaved?: (profile: StudentProfile) => void;
  onClose?: () => void;
}

export const StudentProfileSetup: React.FC<StudentProfileSetupProps> = ({ onSaved, onClose }) => {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState(user?.name || '');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [collegeEmail, setCollegeEmail] = useState(user?.email || '');
  const [course, setCourse] = useState('');
  const [yearOrSemester, setYearOrSemester] = useState('Year 1 (Sem 1)');
  const [campus, setCampus] = useState('Main Campus');
  const [hostelOrBlock, setHostelOrBlock] = useState('');
  const [floor, setFloor] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Load existing profile from server
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getStudentProfile()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.profile) {
          const p = res.profile;
          setFullName(p.fullName || user?.name || '');
          setEnrollmentNumber(p.enrollmentNumber || '');
          setMobileNumber(p.mobileNumber || '');
          setCollegeEmail(p.collegeEmail || user?.email || '');
          setCourse(p.course || '');
          setYearOrSemester(p.yearOrSemester || 'Year 1 (Sem 1)');
          setCampus(p.campus || 'Main Campus');
          setHostelOrBlock(p.hostelOrBlock || '');
          setFloor(p.floor || '');
          setRoomNumber(p.roomNumber || '');
          setEmergencyContactName(p.emergencyContactName || '');
          setEmergencyContactPhone(p.emergencyContactPhone || '');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load profile details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!enrollmentNumber.trim()) {
      setErrorMessage('Student ID / Enrollment Number is required.');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.replace(/\D/g, '').length < 8) {
      setErrorMessage('Please provide a valid registered mobile number.');
      return;
    }
    if (!course.trim()) {
      setErrorMessage('Course / Department is required.');
      return;
    }
    if (!campus.trim()) {
      setErrorMessage('Please select your primary campus / site.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.updateStudentProfile({
        fullName: fullName.trim(),
        enrollmentNumber: enrollmentNumber.trim(),
        mobileNumber: mobileNumber.trim(),
        collegeEmail: collegeEmail.trim(),
        course: course.trim(),
        yearOrSemester: yearOrSemester.trim(),
        campus: campus.trim(),
        hostelOrBlock: hostelOrBlock.trim() || undefined,
        floor: floor.trim() || undefined,
        roomNumber: roomNumber.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined
      });

      if (res.success && res.profile) {
        setSuccessMessage('Student profile successfully saved and verified!');
        if (refreshUser) await refreshUser();
        if (onSaved) onSaved(res.profile);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(res.error || 'Failed to save profile.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-600">Retrieving verified student profile from server...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Student Profile &amp; Residence Setup</h2>
            <p className="text-xs text-blue-200">
              Details persist securely across sessions and are automatically used to prefill emergency and maintenance dispatches.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Academic Identity */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <GraduationCap size={14} className="text-blue-600" />
            <span>Academic Identity (Required)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Chen"
                required
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student ID / Enrollment Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={enrollmentNumber}
                onChange={(e) => setEnrollmentNumber(e.target.value)}
                placeholder="e.g. EN-2024-CS-088"
                required
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course / Department <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. B.S. Computer Science"
                required
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Year / Semester <span className="text-rose-500">*</span>
              </label>
              <select
                value={yearOrSemester}
                onChange={(e) => setYearOrSemester(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              >
                <option value="Year 1 (Sem 1)">Year 1 (Semester 1)</option>
                <option value="Year 1 (Sem 2)">Year 1 (Semester 2)</option>
                <option value="Year 2 (Sem 3)">Year 2 (Semester 3)</option>
                <option value="Year 2 (Sem 4)">Year 2 (Semester 4)</option>
                <option value="Year 3 (Sem 5)">Year 3 (Semester 5)</option>
                <option value="Year 3 (Sem 6)">Year 3 (Semester 6)</option>
                <option value="Year 4 (Sem 7)">Year 4 (Semester 7)</option>
                <option value="Year 4 (Sem 8)">Year 4 (Semester 8)</option>
                <option value="Postgraduate / PhD">Postgraduate / PhD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Contact Details */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Phone size={14} className="text-blue-600" />
            <span>Contact Details (Required)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Used by responders during campus emergency alerts.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                College Email (Verified)
              </label>
              <input
                type="email"
                value={collegeEmail}
                readOnly
                disabled
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Campus & Residence */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Home size={14} className="text-blue-600" />
              <span>Campus &amp; Residence Location</span>
            </h3>
            <span className="text-[10px] text-slate-400">Hostel &amp; room optional for day scholars</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Campus / Site <span className="text-rose-500">*</span>
              </label>
              <select
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              >
                <option value="Main Campus">Main Campus</option>
                <option value="North Campus">North Campus</option>
                <option value="South Campus">South Campus</option>
                <option value="East Engineering Quad">East Engineering Quad</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hostel / Building / Block <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                type="text"
                value={hostelOrBlock}
                onChange={(e) => setHostelOrBlock(e.target.value)}
                placeholder="e.g. North Residential Hall"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Floor
                </label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="e.g. 2nd Floor"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room No.
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 204"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Optional Emergency Contact */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <HeartHandshake size={14} className="text-rose-500" />
            <span>Emergency Contact (Optional)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Emergency Contact Name &amp; Relationship
              </label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="e.g. David Chen (Parent)"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Emergency Contact Phone
              </label>
              <input
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="e.g. +1 (555) 901-2244"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Note: Emergency contacts are not automatically responders; campus security and medical services are notified first.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Persists securely in server database</span>
          </div>

          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Save Profile Details</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
