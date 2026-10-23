import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileQuestion,
  RefreshCw,
  Building,
  MapPin,
  Camera,
  Info,
  Check,
  Eye,
  Languages
} from 'lucide-react';
import {
  TICKET_CATEGORIES,
  TicketCategory,
  AIAnalysis,
  DuplicateCandidate,
  CATEGORY_DEPARTMENT_ROUTING,
  Ticket
} from '../../shared/types.js';
import { CategoryBadge } from '../common/CategoryBadge.js';
import { apiClient } from '../../services/apiClient.js';
import { useAuth } from '../../context/AuthContext.js';

interface ComplaintFormProps {
  onSuccess: (ticket: Ticket) => void;
  onNavigateToTrack: (ticketId: string) => void;
  prefillData?: {
    building?: string;
    location?: string;
    description?: string;
  };
}

const COMMON_CAMPUS_BUILDINGS = [
  'Science & Engineering Complex',
  'Main Academic Quad',
  'Student Union Center',
  'University Memorial Library',
  'North Residential Hall',
  'South Quad Dorms',
  'Athletic & Recreation Pavilion',
  'Fine Arts & Design Building'
];

export const ComplaintForm: React.FC<ComplaintFormProps> = ({
  onSuccess,
  onNavigateToTrack,
  prefillData
}) => {
  const { user } = useAuth();

  // Form fields
  const [building, setBuilding] = useState(prefillData?.building || user?.profile?.hostelOrBlock || '');
  const [location, setLocation] = useState(prefillData?.location || (user?.profile?.roomNumber ? `${user.profile.floor ? `${user.profile.floor}, ` : ''}${user.profile.roomNumber}` : ''));
  const [description, setDescription] = useState(prefillData?.description || '');
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory>('Plumbing');
  const [customProblemTitle, setCustomProblemTitle] = useState('');
  const [categorySource, setCategorySource] = useState<'student' | 'ai_suggested'>('student');

  // Image upload
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // AI Analysis state (One workflow only: Student Intake)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Review step before final submission
  const [isReviewStep, setIsReviewStep] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle Photo selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Photo size exceeds 5MB. Please upload a smaller image.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setImagePreviewUrl(dataUri);
      setImageMimeType(file.type);
      setImageBase64(dataUri);
    };
    reader.onerror = () => {
      setImageError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setImageBase64(null);
    setImageMimeType(null);
    setImagePreviewUrl(null);
    setImageError(null);
  };

  // Run Gemini Triage (Hindi, English, or Hinglish)
  const handleAnalyzeWithAI = async () => {
    if (!description.trim()) {
      setAnalysisError('Please enter a description of the issue first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await apiClient.analyzeComplaint({
        description: description.trim(),
        building: building.trim() || undefined,
        location: location.trim() || undefined,
        imageBase64: imageBase64 || undefined,
        mimeType: imageMimeType || undefined
      });

      if (response.success && response.analysis) {
        setAiAnalysis(response.analysis);
        setSelectedCategory(response.analysis.suggestedCategory);
        setCategorySource('ai_suggested');
        setDuplicateCandidates(response.duplicateCandidates || []);

        // Initialize follow-up questions
        const initialAnswers: Record<string, string> = {};
        response.analysis.followUpQuestions.forEach((q) => {
          initialAnswers[q] = '';
        });
        setFollowUpAnswers(initialAnswers);
      } else {
        setAnalysisError('AI analysis could not complete. You can select your category manually.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'AI service temporarily unavailable. Manual selection enabled.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!building.trim()) {
      setSubmitError('Please select or specify the campus building.');
      return;
    }
    if (!location.trim()) {
      setSubmitError('Please provide specific room, floor, or area details.');
      return;
    }
    if (!description.trim()) {
      setSubmitError('Please describe the facility issue.');
      return;
    }

    // Strict validation for 'Other' category requiring custom problem title
    if (selectedCategory === 'Other' && !customProblemTitle.trim()) {
      setSubmitError('When category is "Other", a custom Problem Title is required.');
      return;
    }

    setIsReviewStep(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiClient.submitComplaint({
        description: description.trim(),
        location: location.trim(),
        building: building.trim(),
        category: selectedCategory,
        customProblemTitle: selectedCategory === 'Other' ? customProblemTitle.trim() : undefined,
        categorySource,
        imageBase64: imageBase64 || undefined,
        mimeType: imageMimeType || undefined,
        aiAnalysis: aiAnalysis || undefined,
        studentFollowUpAnswers: followUpAnswers
      });

      if (res.success && res.ticket) {
        onSuccess(res.ticket);
      } else {
        setSubmitError(res.error || 'Failed to submit complaint. Your input has been preserved.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error communicating with server. Your input has been preserved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            {isReviewStep ? 'Step 2 of 2: Review & Confirm' : 'Step 1 of 2: Issue Description'}
          </span>
          <h2 className="text-xl font-bold text-slate-900">
            {isReviewStep ? 'Review Your Maintenance Complaint' : 'Report Campus Facility Issue'}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Languages size={15} className="text-indigo-600" />
          <span className="hidden sm:inline">Supports English, हिंदी, or Hinglish</span>
        </div>
      </div>

      {submitError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2 font-medium">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* REVIEW STEP VIEW */}
      {isReviewStep ? (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Verified Submission Summary
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Category</span>
                <span className="font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <CategoryBadge category={selectedCategory} />
                  {selectedCategory === 'Other' && customProblemTitle && (
                    <span className="text-slate-700 italic">({customProblemTitle})</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Assigned Routing</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {CATEGORY_DEPARTMENT_ROUTING[selectedCategory]}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Building &amp; Specific Room</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {building} • {location}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Reporting Student</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {user?.name} ({user?.email})
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-100 text-xs">
              <span className="text-slate-500 block mb-1">Issue Description</span>
              <p className="text-slate-800 bg-white p-3 rounded-xl border border-blue-100 font-medium">
                {description}
              </p>
            </div>

            {aiAnalysis && (
              <div className="pt-2 text-xs">
                <span className="text-slate-500 block mb-1">AI Concise Summary</span>
                <p className="text-indigo-900 bg-indigo-50 p-2.5 rounded-xl border border-indigo-200 font-medium">
                  {aiAnalysis.conciseSummary}
                </p>
              </div>
            )}

            {Object.keys(followUpAnswers).length > 0 && (
              <div className="pt-2 text-xs space-y-1">
                <span className="text-slate-500 block">Student Clarification Answers</span>
                {Object.entries(followUpAnswers).map(([q, a]) => (
                  <div key={q} className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-semibold">{q}: </span>
                    <span className="text-slate-900">{a || 'Not specified'}</span>
                  </div>
                ))}
              </div>
            )}

            {imagePreviewUrl && (
              <div className="pt-2 text-xs">
                <span className="text-slate-500 block mb-1">Attached Photo Evidence</span>
                <img
                  src={imagePreviewUrl}
                  alt="Complaint Preview"
                  className="w-32 h-24 object-cover rounded-xl border border-slate-300"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsReviewStep(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Back to Edit
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Confirm &amp; Submit Complaint</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* EDIT / FORM VIEW */
        <form onSubmit={handleProceedToReview} className="space-y-6">
          {/* Location Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building size={14} className="text-blue-600" />
                <span>Campus Building <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                list="campus-buildings"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Select or enter building..."
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="campus-buildings">
                {COMMON_CAMPUS_BUILDINGS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-600" />
                <span>Exact Room / Wing / Area <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 204, West Restroom, 3rd Floor Wing"
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Issue Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Describe the Facility Problem <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                You can write in English, Hindi (हिंदी), or Hinglish
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Washroom sink 2 leaking continuously, or 'pankha nahi chal raha hai lab 204 me', or 'eduroam wifi keeps dropping every two minutes'..."
              rows={4}
              required
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Photo Attachment & AI Triage Trigger */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera size={14} className="text-blue-600" />
                  <span>Attach Photo Evidence (Optional)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Multimodal inspection verifies defects directly with facilities staff.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs">
                  <Upload size={13} />
                  <span>{imageBase64 ? 'Change Photo' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing || !description.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Run Gemini 3.8 Flash analysis"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-yellow-300" />
                      <span>AI Triage Complaint</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {imageError && (
              <p className="text-xs text-rose-600 font-medium">{imageError}</p>
            )}

            {imagePreviewUrl && (
              <div className="relative inline-block mt-2">
                <img
                  src={imagePreviewUrl}
                  alt="Attachment Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-slate-300 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
                  title="Remove photo"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* AI Analysis Feedback Panel (If triggered) */}
          {aiAnalysis && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">
                    Gemini AI Triage Assessment
                  </span>
                  {aiAnalysis.detectedLanguage && (
                    <span className="text-[10px] bg-indigo-200/60 text-indigo-900 px-2 py-0.5 rounded font-semibold">
                      Detected: {aiAnalysis.detectedLanguage}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  Confidence: {aiAnalysis.confidence} ({Math.round(aiAnalysis.confidenceScore * 100)}%)
                </span>
              </div>

              <div className="text-xs text-indigo-900 bg-white p-3 rounded-xl border border-indigo-100">
                <span className="font-bold">Concise Summary: </span>
                {aiAnalysis.conciseSummary}
              </div>

              {aiAnalysis.imageObservations && (
                <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900">Photo Inspection: </span>
                  {aiAnalysis.imageObservations}
                </div>
              )}

              {/* Follow-up Clarification Questions (Updates same draft) */}
              {aiAnalysis.followUpQuestions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <HelpCircle size={13} className="text-indigo-600" />
                    <span>Follow-up Clarifications (Optional - Updates this complaint)</span>
                  </span>
                  {aiAnalysis.followUpQuestions.map((q) => (
                    <div key={q} className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">{q}</label>
                      <input
                        type="text"
                        value={followUpAnswers[q] || ''}
                        onChange={(e) =>
                          setFollowUpAnswers({
                            ...followUpAnswers,
                            [q]: e.target.value
                          })
                        }
                        placeholder="Your clarification..."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Duplicate Candidates Advisory Warning */}
          {duplicateCandidates.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle size={15} className="text-amber-600" />
                <span>Possible Duplicate Complaints Detected in This Area</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Similar reports already exist for this location. You may still submit your complaint, and staff will review both:
              </p>
              <div className="space-y-1.5 pt-1">
                {duplicateCandidates.map((dup) => (
                  <div
                    key={dup.ticketId}
                    className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{dup.ticketId}: </span>
                      <span className="text-slate-700">{dup.title}</span>
                      <p className="text-[10px] text-amber-700">{dup.matchReason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateToTrack(dup.ticketId)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold underline shrink-0"
                    >
                      Track Existing
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Selection (5 Categories) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Maintenance Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TICKET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCategorySource('student');
                  }}
                  className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-center cursor-pointer ${
                    selectedCategory === cat
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Custom Problem Title (MANDATORY if 'Other' is chosen) */}
            {selectedCategory === 'Other' && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-1">
                <label className="block text-xs font-bold text-slate-800">
                  Custom Problem Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customProblemTitle}
                  onChange={(e) => setCustomProblemTitle(e.target.value)}
                  placeholder="e.g. Broken laboratory fume hood sash or auditorium seat hinge"
                  required
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-[10px] text-slate-500">
                  A specific custom problem title is required when selecting 'Other'.
                </p>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Assigned to: <strong className="text-slate-700">{CATEGORY_DEPARTMENT_ROUTING[selectedCategory]}</strong>
            </span>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Review &amp; Confirm Complaint</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
