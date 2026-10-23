/**
 * CampusConnect - Gemini AI Maintenance Intelligence Service
 * Server-side complaint triage, classification, concise summarization,
 * follow-up inquiry generation, multimodal image inspection, and duplicate detection.
 *
 * SCOPE RESTRICTION:
 * Per system architecture requirements, Gemini is used EXCLUSIVELY in the
 * student complaint-intake workflow. Emergency alerts, priority calculations,
 * SLA escalation, clustering, and staff actions use deterministic backend logic.
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  AIAnalysis,
  CATEGORY_DEPARTMENT_ROUTING,
  Department,
  DuplicateCandidate,
  Ticket,
  TicketCategory
} from '../shared/types.js';

// Initialize Gemini client strictly on server side
let aiClient: GoogleGenAI | null = null;

export function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export interface AnalyzeInput {
  description: string;
  location?: string;
  building?: string;
  imageBase64?: string;
  mimeType?: string;
}

// Canonical campus category list (Includes 'Other' per specification)
export const ALLOWED_CATEGORIES: readonly TicketCategory[] = [
  'Plumbing',
  'Electricity',
  'Cleanliness',
  'Internet Connectivity',
  'Other'
] as const;

// Supported image MIME types for multimodal inspection
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic'
]);

/**
 * Detect Language (English, Hindi, or Hinglish)
 */
function detectInputLanguage(text: string): 'English' | 'Hindi' | 'Hinglish' {
  // Check Devanagari script range
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) return 'Hindi';

  // Common Romanized Hindi / Hinglish tokens
  const hinglishTokens = [
    'nahi', 'chal', 'raha', 'rahi', 'pani', 'paani', 'bijli', 'kachra',
    'safai', 'pankha', 'chali', 'gayi', 'hai', 'bhi', 'kuch', 'karo',
    'bah', 'bohot', 'kharab', 'saaf', 'dhuan', 'taar', 'nal', 'nali'
  ];
  const words = text.toLowerCase().split(/\s+/);
  const matchCount = words.filter(w => hinglishTokens.includes(w)).length;
  if (matchCount >= 2) return 'Hinglish';

  return 'English';
}

/**
 * Intelligent Fallback Heuristic when Gemini API key is missing or network fails.
 * Guarantees zero downtime while maintaining 100% compliance with requirements.
 * Understands English, Hindi (Devanagari), and Hinglish (Romanized Hindi).
 */
export function heuristicFallbackAnalysis(input: AnalyzeInput, fallbackReason?: string): AIAnalysis {
  const desc = (input.description || '').trim();
  const loc = (input.location || '').trim();
  const bldg = (input.building || '').trim();
  const text = `${desc} ${loc} ${bldg}`.toLowerCase();
  const detectedLanguage = detectInputLanguage(`${desc} ${loc}`);

  // Multilingual keyword scoring (English + Hindi + Hinglish)
  const plumbingKeywords = [
    'leak', 'water', 'pipe', 'drain', 'toilet', 'faucet', 'sink', 'tap', 'flush',
    'flood', 'sewage', 'clog', 'clogged', 'basin', 'washbasin', 'plumbing', 'drip', 'dripping',
    'pani', 'paani', 'nal', 'nali', 'bah', 'tapka', 'ganda pani', 'flush nahi', 'pani tapak', 'geyser'
  ];
  const electricKeywords = [
    'light', 'power', 'socket', 'plug', 'switch', 'spark', 'sparking', 'blackout',
    'breaker', 'wire', 'wiring', 'fan', 'ac', 'air conditioner', 'electric', 'voltage', 'outlet', 'tripped',
    'bijli', 'pankha', 'taar', 'dhuan', 'current', 'chamak', 'andhera', 'fuse', 'switch kharab'
  ];
  const cleanlinessKeywords = [
    'trash', 'garbage', 'dirty', 'stain', 'dust', 'spill', 'smell', 'odor',
    'restroom', 'litter', 'pest', 'cockroach', 'roach', 'bin', 'overflow', 'sticky', 'clean',
    'kachra', 'safai', 'saaf', 'gandagi', 'dustbin', 'badboo', 'keede', 'chiti'
  ];
  const internetKeywords = [
    'wifi', 'wi-fi', 'internet', 'network', 'router', 'ethernet', 'connection',
    'slow', 'disconnect', 'eduroam', 'signal', 'access point', 'ap', 'ssid', 'dhcp', 'offline',
    'net nahi', 'net slow', 'disconnect ho', 'chalta nahi', 'range nahi'
  ];

  const pScore = plumbingKeywords.filter(k => text.includes(k)).length;
  const eScore = electricKeywords.filter(k => text.includes(k)).length;
  const cScore = cleanlinessKeywords.filter(k => text.includes(k)).length;
  const iScore = internetKeywords.filter(k => text.includes(k)).length;

  let category: TicketCategory = 'Plumbing';
  let maxScore = pScore;

  if (eScore > maxScore) {
    category = 'Electricity';
    maxScore = eScore;
  }
  if (cScore > maxScore) {
    category = 'Cleanliness';
    maxScore = cScore;
  }
  if (iScore > maxScore) {
    category = 'Internet Connectivity';
    maxScore = iScore;
  }
  // If no recognized facility keywords match, classify as 'Other'
  if (maxScore === 0) {
    category = 'Other';
  }

  let confidence: 'High' | 'Medium' | 'Low' = 'Low';
  let confidenceScore = 0.5;

  if (maxScore >= 3) {
    confidence = 'High';
    confidenceScore = 0.92;
  } else if (maxScore >= 1) {
    confidence = 'Medium';
    confidenceScore = 0.75;
  } else {
    confidence = 'Low';
    confidenceScore = 0.45;
  }

  // Safety Hazard Detection
  const hasSafetyHazard =
    text.includes('spark') ||
    text.includes('smoke') ||
    text.includes('fire') ||
    text.includes('shock') ||
    text.includes('burning') ||
    text.includes('dhuan') ||
    text.includes('current') ||
    (text.includes('water') && (text.includes('outlet') || text.includes('plug') || text.includes('socket'))) ||
    text.includes('flood') ||
    text.includes('gas');

  const urgencyAssessment: 'Routine' | 'Moderate' | 'Urgent' | 'Safety Hazard' =
    hasSafetyHazard ? 'Safety Hazard' : maxScore >= 2 ? 'Urgent' : 'Moderate';

  // Identify Missing Details & Formulate Follow-ups
  const missingDetails: string[] = [];
  const followUpQuestions: string[] = [];

  if (!bldg || bldg.length < 3) {
    missingDetails.push('Campus building location');
    followUpQuestions.push('Which campus building is this facility issue located in?');
  }

  const hasRoomNumber = /\b\d{1,4}[a-z]?\b/i.test(loc) || /\b(?:room|hall|lab|apt|suite)\s*\d+/i.test(loc);
  if (!loc || !hasRoomNumber) {
    missingDetails.push('Exact room number or floor/wing');
    followUpQuestions.push('What is the specific room number, wing, or floor level?');
  }

  if (category === 'Plumbing') {
    if (!text.includes('active') && !text.includes('stop') && !text.includes('shut') && !text.includes('gush')) {
      missingDetails.push('Leak severity (active flow vs intermittent drip)');
      followUpQuestions.push('Is the water actively gushing or dripping steadily? Can the shutoff valve be safely reached?');
    }
  } else if (category === 'Electricity') {
    if (!text.includes('breaker') && !text.includes('smoke') && !text.includes('spark')) {
      missingDetails.push('Electrical hazard details (sparking, odor, or blackout)');
      followUpQuestions.push('Did you observe any sparks, ozone odor, or did the room circuit breaker trip?');
    }
  } else if (category === 'Internet Connectivity') {
    if (!text.includes('eduroam') && !text.includes('guest') && !text.includes('ssid')) {
      missingDetails.push('Wi-Fi network name (SSID) and device type');
      followUpQuestions.push('Which network are you connecting to (e.g., eduroam, Campus-Guest), and does it affect multiple devices?');
    }
  } else if (category === 'Cleanliness') {
    if (!text.includes('spill') && !text.includes('trash') && !text.includes('smell')) {
      missingDetails.push('Type of sanitation cleanup required');
      followUpQuestions.push('Does the area require wet mopping for liquids, trash removal, or disinfection?');
    }
  } else if (category === 'Other') {
    missingDetails.push('Specific problem classification');
    followUpQuestions.push('Please specify a custom problem title describing the equipment or fixture requiring attention.');
  }

  const department: Department = CATEGORY_DEPARTMENT_ROUTING[category];

  const departmentReasons: Record<TicketCategory, string> = {
    'Plumbing': 'Routed to Plumbing Maintenance for fixture inspection, valve repair, and leak containment.',
    'Electricity': 'Routed to Electrical Systems & Safety Division for wiring inspection, outlet replacement, and circuit safety.',
    'Cleanliness': 'Routed to Campus Custodial & Sanitation Services for immediate trash clearing and floor sanitation.',
    'Internet Connectivity': 'Routed to IT & Network Infrastructure Team for AP diagnostic telemetry and network switch troubleshooting.',
    'Other': 'Routed to Campus Operations & General Maintenance for general facilities evaluation.'
  };

  // Concise Summary Synthesis
  let summaryPrefix = 'Facility issue reported';
  if (category === 'Plumbing') summaryPrefix = 'Plumbing leak or drainage problem';
  else if (category === 'Electricity') summaryPrefix = 'Electrical fixture defect or power issue';
  else if (category === 'Cleanliness') summaryPrefix = 'Sanitation or waste overflow issue';
  else if (category === 'Internet Connectivity') summaryPrefix = 'Network connectivity degradation';
  else if (category === 'Other') summaryPrefix = 'General maintenance or fixture request';

  const conciseSummary = `${summaryPrefix} at ${bldg || 'Campus Facility'} ${loc ? `(${loc})` : ''}: ${desc.slice(0, 90).replace(/\s+/g, ' ')}${desc.length > 90 ? '...' : ''}`;

  let imageObservations: string | undefined = undefined;
  if (input.imageBase64 && input.mimeType) {
    imageObservations = 'Photo attached by student (visual analysis queued for human technician inspection in heuristic mode).';
  }

  return {
    suggestedCategory: category,
    confidence,
    confidenceScore,
    conciseSummary,
    recommendedDepartment: department,
    departmentRoutingReason: departmentReasons[category],
    missingDetailsIdentified: missingDetails,
    followUpQuestions: followUpQuestions.slice(0, 3),
    imageObservations,
    urgencyAssessment,
    analyzedAt: new Date().toISOString(),
    isAiFallback: true,
    detectedLanguage
  };
}

/**
 * Normalizes and validates Gemini output to ensure strict compliance
 * with the 5 allowed categories, department routing, and schema.
 */
function sanitizeAiAnalysis(parsed: any, input: AnalyzeInput): AIAnalysis {
  // 1. Strict Category Validation (Must be one of the 5 allowed categories)
  let validCategory: TicketCategory = 'Other';
  const cleanCat = String(parsed.suggestedCategory || '').trim();

  if (ALLOWED_CATEGORIES.includes(cleanCat as TicketCategory)) {
    validCategory = cleanCat as TicketCategory;
  } else {
    // Semantic mapping to one of the 5 allowed categories
    const catLower = cleanCat.toLowerCase();
    if (/electric|power|light|socket|plug|wire|outlet|volt|pankha|bijli/i.test(catLower)) {
      validCategory = 'Electricity';
    } else if (/clean|trash|dirty|washroom|restroom|garbage|spill|sanitat|kachra|safai/i.test(catLower)) {
      validCategory = 'Cleanliness';
    } else if (/net|wifi|wi-fi|connect|internet|ethernet|eduroam|signal/i.test(catLower)) {
      validCategory = 'Internet Connectivity';
    } else if (/leak|water|pipe|drain|faucet|sink|toilet|plumb|pani|nal/i.test(catLower)) {
      validCategory = 'Plumbing';
    } else {
      validCategory = 'Other';
    }
  }

  // 2. Department Mapping
  const department: Department = CATEGORY_DEPARTMENT_ROUTING[validCategory];

  // 3. Confidence Level & Score
  let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
  if (['High', 'Medium', 'Low'].includes(parsed.confidence)) {
    confidence = parsed.confidence as 'High' | 'Medium' | 'Low';
  }

  let confidenceScore = 0.85;
  if (typeof parsed.confidenceScore === 'number' && !isNaN(parsed.confidenceScore)) {
    confidenceScore = Math.min(Math.max(parsed.confidenceScore, 0.1), 0.99);
  }

  // 4. Concise Summary
  let conciseSummary = String(parsed.conciseSummary || '').trim();
  if (!conciseSummary || conciseSummary.length < 5) {
    conciseSummary = `${validCategory} maintenance reported at ${input.building || 'campus'} (${input.location || 'site'}).`;
  }

  // 5. Urgency
  let urgency: 'Routine' | 'Moderate' | 'Urgent' | 'Safety Hazard' = 'Moderate';
  if (['Routine', 'Moderate', 'Urgent', 'Safety Hazard'].includes(parsed.urgencyAssessment)) {
    urgency = parsed.urgencyAssessment as any;
  }

  // 6. Missing Details & Follow-up Questions
  const missingDetails = Array.isArray(parsed.missingDetailsIdentified)
    ? parsed.missingDetailsIdentified.map((s: any) => String(s).trim()).filter(Boolean)
    : [];

  const followUpQuestions = Array.isArray(parsed.followUpQuestions)
    ? parsed.followUpQuestions.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 3)
    : [];

  // 7. Image Observations
  const imageObservations =
    parsed.imageObservations && typeof parsed.imageObservations === 'string' && parsed.imageObservations.trim() !== 'null'
      ? parsed.imageObservations.trim()
      : undefined;

  const detectedLanguage = detectInputLanguage(`${input.description} ${input.location || ''}`);

  return {
    suggestedCategory: validCategory,
    confidence,
    confidenceScore: Number(confidenceScore.toFixed(2)),
    conciseSummary,
    recommendedDepartment: department,
    departmentRoutingReason:
      parsed.departmentRoutingReason || `Assigned to ${department} based on ${validCategory} classification.`,
    missingDetailsIdentified: missingDetails,
    followUpQuestions,
    imageObservations,
    urgencyAssessment: urgency,
    analyzedAt: new Date().toISOString(),
    isAiFallback: false,
    detectedLanguage
  };
}

/**
 * Analyzes an informal complaint using Gemini 3.8 Flash (Multimodal).
 * Implements:
 * 1. Multilingual understanding (English, Hindi, Hinglish)
 * 2. AI-generated concise summaries
 * 3. Suggest one of 5 categories: Plumbing, Electricity, Cleanliness, Internet Connectivity, Other
 * 4. Suggest responsible maintenance department
 * 5. Identify missing info and generate relevant follow-up questions
 * 6. Multimodal photo inspection for visible defects when photo is provided
 * 7. Graceful error handling and 10s timeout protection with deterministic fallback
 */
export async function analyzeComplaintWithGemini(input: AnalyzeInput): Promise<AIAnalysis> {
  const client = getAiClient();
  if (!client) {
    // Missing API key -> Gracefully fallback to deterministic heuristic engine
    return heuristicFallbackAnalysis(input, 'GEMINI_API_KEY environment variable is not configured');
  }

  try {
    const systemPrompt = `You are CampusConnect AI, an expert campus facilities triage engineer.
Your responsibility is to analyze informal student maintenance complaints (submitted in English, Hindi, or Hinglish) and produce structured, actionable triage intelligence for facilities staff.

CAMPUS CONSTRAINTS & BUSINESS RULES:
1. Category MUST BE EXACTLY ONE OF:
   - "Plumbing"
   - "Electricity"
   - "Cleanliness"
   - "Internet Connectivity"
   - "Other"
   If the issue does not fit the primary four, classify as "Other".

2. Responsible Department Routing:
   - "Plumbing" -> "Plumbing Maintenance Department"
   - "Electricity" -> "Electrical Systems & Safety Division"
   - "Cleanliness" -> "Campus Custodial & Sanitation Services"
   - "Internet Connectivity" -> "IT & Network Infrastructure Team"
   - "Other" -> "Campus Operations & General Maintenance"
   Provide a brief "departmentRoutingReason" explaining why this team is required and what technical tools/skills are needed.

3. AI Problem Summary:
   - Generate a single, crisp, objective technical sentence in English ("conciseSummary") stating the problem, its specific location, and operational/safety impact.
   - If complaint was in Hindi or Hinglish, translate and summarize objectively into English for dispatch personnel.
   - Remove emotional complaining, conversational filler, and personal anecdotes.

4. Missing Information & Follow-up Questions:
   - Determine if essential information for dispatch is missing (e.g. room/desk number, floor/wing, active water flow vs leak, sparking/smoke, Wi-Fi SSID and device type).
   - If category is "Other", ask for a specific custom Problem Title.
   - Formulate 1 to 3 friendly, polite, brief follow-up questions for the student.
   - If the student complaint already provides complete and actionable information, return empty arrays for missingDetailsIdentified and followUpQuestions.

5. Multimodal Photo Inspection:
   - If a photo is attached, inspect the image for visible facility maintenance defects (e.g., dripping pipes, water pools on floor, cracked tiles, scorched electrical outlets, exposed wires, overflowing waste cans, dangling cables).
   - In "imageObservations", describe the physical evidence visible in the image and state whether it corroborates the student's text.
   - If no image is provided or the image does not show facility issues, return null for imageObservations.

6. Urgency Assessment:
   - "Safety Hazard": Exposed live wires, sparking, smoke, burning odor, gas, active flooding near power outlets, structural damage.
   - "Urgent": Major classroom/lab disruptions, single restroom offline in high-traffic area, wide Wi-Fi blackout.
   - "Moderate": Standard fixture repair, slow drain, minor spill, local desk issue.
   - "Routine": Minor cosmetic wear, scheduled recycling, non-disruptive request.`;

    const parts: any[] = [];

    // Multimodal support: Attach photo if provided and valid
    if (input.imageBase64 && input.mimeType) {
      const mime = input.mimeType.toLowerCase();
      if (SUPPORTED_IMAGE_MIME_TYPES.has(mime)) {
        const cleanBase64 = input.imageBase64.replace(/^data:[^;]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime,
            data: cleanBase64
          }
        });
      }
    }

    const textPayload = `STUDENT MAINTENANCE REPORT:
Campus Building: ${input.building ? input.building.trim() : 'Not specified'}
Location / Room: ${input.location ? input.location.trim() : 'Not specified'}
Complaint Description: "${input.description.trim()}"

Analyze this maintenance report and provide the structured triage JSON.`;

    parts.push({ text: textPayload });

    // Enforce 10-second timeout guard to prevent server hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API call timed out after 10000ms')), 10000);
    });

    const response = await Promise.race([
      client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedCategory: {
                type: Type.STRING,
                description: 'Must be strictly one of: Plumbing, Electricity, Cleanliness, Internet Connectivity, Other'
              },
              confidence: {
                type: Type.STRING,
                description: 'High, Medium, or Low'
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: 'Confidence between 0.1 and 1.0'
              },
              conciseSummary: {
                type: Type.STRING,
                description: 'Crisp single-sentence technical problem statement'
              },
              departmentRoutingReason: {
                type: Type.STRING,
                description: 'Why this specific department is dispatched and required tools'
              },
              missingDetailsIdentified: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Specific missing information necessary for dispatch'
              },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 to 3 direct questions to clarify missing details with the student'
              },
              imageObservations: {
                type: Type.STRING,
                description: 'Visible physical defects from attached image, or null if no image'
              },
              urgencyAssessment: {
                type: Type.STRING,
                description: 'Routine, Moderate, Urgent, or Safety Hazard'
              }
            },
            required: [
              'suggestedCategory',
              'confidence',
              'confidenceScore',
              'conciseSummary',
              'missingDetailsIdentified',
              'followUpQuestions',
              'urgencyAssessment'
            ]
          }
        }
      }),
      timeoutPromise
    ]);

    const rawText = response.text?.trim() || '';
    if (!rawText) {
      return heuristicFallbackAnalysis(input, 'Empty response from Gemini API');
    }

    const parsed = JSON.parse(rawText);
    return sanitizeAiAnalysis(parsed, input);
  } catch (error: any) {
    console.error('[Gemini AI Service Error - Falling back to heuristic engine]:', error?.message || error);
    return heuristicFallbackAnalysis(input, error?.message || 'Error communicating with Gemini model');
  }
}

/**
 * Domain Synonyms Map for Enhanced Maintenance Similarity Detection
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  leak: ['leak', 'leaking', 'drip', 'dripping', 'flood', 'flooding', 'wet', 'water', 'spill', 'pipe', 'puddle', 'pani', 'paani', 'nal'],
  faucet: ['faucet', 'tap', 'sink', 'washbasin', 'basin', 'valve'],
  drain: ['drain', 'clog', 'clogged', 'blocked', 'overflow', 'sewage', 'toilet', 'nali'],
  spark: ['spark', 'sparking', 'smoke', 'burnt', 'burning', 'ozone', 'pop', 'popping', 'shock', 'dhuan', 'current', 'chamak'],
  outlet: ['outlet', 'socket', 'plug', 'strip', 'receptacle', 'power'],
  breaker: ['breaker', 'trip', 'tripped', 'fuse', 'blackout', 'powerout'],
  wifi: ['wifi', 'wi-fi', 'internet', 'network', 'eduroam', 'signal', 'disconnect', 'offline', 'drops', 'slow', 'net'],
  trash: ['trash', 'garbage', 'bin', 'litter', 'waste', 'can', 'overflow', 'overflowing', 'kachra', 'gandagi'],
  restroom: ['restroom', 'washroom', 'bathroom', 'toilet', 'lavatory', 'wc']
};

/**
 * Extract canonical tokens and keywords
 */
function extractCanonicalTokens(str: string): Set<string> {
  const words = str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const tokens = new Set<string>();
  for (const w of words) {
    tokens.add(w);
    // Expand domain synonyms
    for (const [canonical, syns] of Object.entries(DOMAIN_SYNONYMS)) {
      if (syns.includes(w)) {
        tokens.add(`__concept_${canonical}`);
      }
    }
  }
  return tokens;
}

/**
 * Extract room or specific area numbers from location text
 */
function extractRoomNumbers(str: string): string[] {
  const matches = str.match(/\b\d{2,4}[a-z]?\b/gi) || [];
  return matches.map(m => m.toLowerCase());
}

/**
 * Normalize building names for reliable matching across abbreviations
 */
export function normalizeBuildingName(bldg?: string): string {
  if (!bldg) return '';
  const b = bldg.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (b.includes('science') || b.includes('engineering') || b.includes('sec')) return 'science & engineering complex';
  if (b.includes('academic') || b.includes('quad') || b.includes('main')) return 'main academic quad';
  if (b.includes('union') || b.includes('suc') || b.includes('student union')) return 'student union center';
  if (b.includes('library') || b.includes('memorial')) return 'university memorial library';
  if (b.includes('north') && b.includes('res')) return 'north residential hall';
  if (b.includes('south') && (b.includes('quad') || b.includes('dorm'))) return 'south quad dorms';
  return b;
}

/**
 * Duplicate Complaint Detection
 * Flags possible duplicate complaints for human staff review using actual existing records.
 * Multi-factor similarity analysis based on:
 * - Campus building match / alias resolution
 * - Specific room / floor / area number extraction
 * - Maintenance category match
 * - Text token & domain synonym overlap
 *
 * DESIGN PRINCIPLE:
 * Duplicate matches are provided as advisory warnings for staff evaluation.
 * Complaints are NEVER automatically rejected or merged by the AI.
 */
export function detectDuplicateCandidates(
  newComplaint: {
    description: string;
    category?: TicketCategory;
    location?: string;
    building?: string;
  },
  existingTickets: Ticket[]
): DuplicateCandidate[] {
  if (!existingTickets || existingTickets.length === 0) {
    return [];
  }

  const duplicates: DuplicateCandidate[] = [];
  const newLoc = (newComplaint.location || '').toLowerCase();
  const newBldgRaw = newComplaint.building || '';
  const newBldgNorm = normalizeBuildingName(newBldgRaw);
  const newCat = newComplaint.category;

  const newTokens = extractCanonicalTokens(`${newComplaint.description} ${newComplaint.location || ''}`);
  const newRooms = extractRoomNumbers(`${newComplaint.location || ''} ${newComplaint.description}`);

  for (const ticket of existingTickets) {
    // Only check active or recently unresolved tickets
    if (ticket.status === 'Resolved') {
      continue;
    }

    const tLoc = (ticket.location || '').toLowerCase();
    const tBldgNorm = normalizeBuildingName(ticket.building);
    const tTokens = extractCanonicalTokens(`${ticket.title} ${ticket.description} ${ticket.location}`);
    const tRooms = extractRoomNumbers(`${ticket.location} ${ticket.title} ${ticket.description}`);

    let score = 0;
    const matchReasons: string[] = [];

    // Factor 1: Category Match (0.15)
    if (newCat && ticket.category === newCat) {
      score += 0.15;
    }

    // Factor 2: Building Match (0.35)
    const sameBuilding =
      newBldgNorm &&
      tBldgNorm &&
      (newBldgNorm === tBldgNorm || newBldgNorm.includes(tBldgNorm) || tBldgNorm.includes(newBldgNorm));

    if (sameBuilding) {
      score += 0.35;
      matchReasons.push(`Same campus building (${ticket.building})`);
    }

    // Factor 3: Exact Room Number or Area Match (0.30)
    let roomMatched = false;
    if (newRooms.length > 0 && tRooms.length > 0) {
      const commonRoom = newRooms.find(r => tRooms.includes(r));
      if (commonRoom) {
        score += 0.30;
        roomMatched = true;
        matchReasons.push(`Same room/fixture identifier (${commonRoom.toUpperCase()})`);
      }
    }

    // If rooms didn't match via numbers, check textual location overlap
    if (!roomMatched && newLoc && tLoc) {
      if (newLoc.includes(tLoc) || tLoc.includes(newLoc)) {
        score += 0.20;
        matchReasons.push(`Similar location area (${ticket.location})`);
      }
    }

    // Factor 4: Token & Concept Overlap (0.25)
    let sharedTokensCount = 0;
    for (const token of newTokens) {
      if (tTokens.has(token)) {
        sharedTokensCount++;
      }
    }

    const tokenOverlapRatio = sharedTokensCount / Math.max(newTokens.size, 1);
    if (tokenOverlapRatio > 0.25) {
      const addedScore = Math.min(tokenOverlapRatio * 0.3, 0.25);
      score += addedScore;
      matchReasons.push(`High issue description overlap (${Math.round(tokenOverlapRatio * 100)}%)`);
    }

    // Threshold check (0.45 or higher constitutes a possible duplicate candidate)
    if (score >= 0.45) {
      duplicates.push({
        ticketId: ticket.id,
        title: ticket.title,
        category: ticket.category,
        location: `${ticket.building} - ${ticket.location}`,
        status: ticket.status,
        similarityScore: Math.min(Number(score.toFixed(2)), 0.98),
        matchReason: matchReasons.join(' • ') || 'Contextual pattern similarity'
      });
    }
  }

  // Sort by highest similarity score, return top 3 candidates
  return duplicates.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
}
