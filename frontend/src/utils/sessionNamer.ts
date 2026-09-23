/**
 * AI Session Namer Plugin
 * 
 * Uniquely & automatically names legal audit/chat sessions based on filenames.
 * Handles company/party extraction and contract classification.
 * Falls back to "Audit [n] – <filename>" when filename is ambiguous, unruly, or generic.
 */

// Common generic or ambiguous prefixes/stems
const AMBIGUOUS_PATTERNS = [
  /^(?:doc|document|scan|file|contract|agreement|test|sample|temp|upload|untitled|page|pdf|draft|new)[\d_\-\s.]*$/i,
  /^[0-9a-f]{8,}(?:-[0-9a-f]{4,})*$/i, // UUID or Hex hashes
  /^\d{4,}[\d_\-\s]*$/,               // Mostly numbers (e.g. 20240923_001)
  /^[a-z0-9]{1,3}$/i,                 // Extremely short stems
];

// Common noise tokens to strip
const NOISE_TOKENS = [
  /\b(?:v\d+|version\s*\d+|final|draft|signed|executed|docusign|copy|scanned|stamped|revised|rev\d*|amended)\b/gi,
  /\b(?:20\d{2}|19\d{2})\b/g, // year numbers like 2024
];

// Known contract types to standardize
const CONTRACT_TYPES: Record<string, string> = {
  logistics: 'Logistics Services Agreement',
  'logistics services': 'Logistics Services Agreement',
  lease: 'Lease Agreement',
  'commercial lease': 'Commercial Lease Agreement',
  'commercial office lease': 'Commercial Office Lease',
  office_lease: 'Office Lease Agreement',
  nda: 'Non-Disclosure Agreement',
  'mutual nda': 'Mutual NDA',
  'non-disclosure': 'Non-Disclosure Agreement',
  'non disclosure': 'Non-Disclosure Agreement',
  employment: 'Employment Agreement',
  consulting: 'Consulting Services Agreement',
  msa: 'Master Services Agreement',
  'master services': 'Master Services Agreement',
  saas: 'SaaS Agreement',
  license: 'License Agreement',
  licensing: 'Licensing Agreement',
  supply: 'Supply Agreement',
  vendor: 'Vendor Agreement',
  settlement: 'Settlement Agreement',
  partnership: 'Partnership Agreement',
  indemnity: 'Indemnity Agreement',
  services: 'Services Agreement',
};

/**
 * Checks whether a filename is ambiguous, unruly, or lacks meaningful legal context.
 */
export function isAmbiguousOrUnruly(rawStem: string): boolean {
  const clean = rawStem.trim();
  if (clean.length < 4) return true;
  return AMBIGUOUS_PATTERNS.some((pat) => pat.test(clean));
}

/**
 * Generates an intelligent, unique, and natural session title based on a contract filename.
 * 
 * @param filename - The original contract file name (e.g. HarborPeak_Northstar_Logistics_Services_Agreement.pdf)
 * @param sessionIndex - Suffix index if multiple sessions exist on the same contract (1, 2, 3...)
 * @returns Clean, professional audit session title without artificial trimming
 */
export function generateSmartSessionTitle(filename: string, sessionIndex: number = 1): string {
  if (!filename) {
    return sessionIndex > 1 ? `Audit ${sessionIndex} – Contract` : 'Contract Audit Session';
  }

  // 1. Strip file extension
  const rawStem = filename.replace(/\.[^/.]+$/, '').trim();

  // 2. Check if the filename is ambiguous or unruly (e.g., scan001, doc_12, random hashes)
  if (isAmbiguousOrUnruly(rawStem)) {
    // Default fallback required by user: "Audit – <filename>" or "Audit n – <filename>"
    const cleanStem = rawStem.replace(/[_\-]+/g, ' ').trim() || 'Contract';
    return sessionIndex > 1 ? `Audit ${sessionIndex} – ${cleanStem}` : `Audit – ${cleanStem}`;
  }

  // 3. Clean noise tokens (e.g., _final, _signed, _v2)
  let working = rawStem;
  for (const pat of NOISE_TOKENS) {
    working = working.replace(pat, ' ');
  }

  // Split on delimiters (underscores, dashes)
  const segments = working
    .split(/[_\-]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return sessionIndex > 1 ? `Audit ${sessionIndex} – ${rawStem}` : `Audit – ${rawStem}`;
  }

  // 4. Check for known contract types in segments
  const fullWorkingLower = segments.join(' ').toLowerCase();
  let matchedType = '';
  for (const [key, label] of Object.entries(CONTRACT_TYPES)) {
    if (fullWorkingLower.includes(key)) {
      matchedType = label;
      break;
    }
  }

  // 5. Extract parties (words before contract keywords or first 1-2 distinct words)
  const partyTokens: string[] = [];
  const contractKeywords = new Set([
    'agreement', 'contract', 'lease', 'nda', 'services', 'logistics',
    'commercial', 'employment', 'consulting', 'msa', 'license', 'supply',
    'settlement', 'partnership', 'terms', 'service'
  ]);

  for (const seg of segments) {
    const subWords = seg.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
    for (const w of subWords) {
      if (contractKeywords.has(w.toLowerCase())) {
        break;
      }
      if (w.length > 1 && !/^\d+$/.test(w)) {
        partyTokens.push(w);
      }
    }
  }

  let title = '';

  if (partyTokens.length >= 2 && matchedType) {
    const p1 = partyTokens[0];
    const p2 = partyTokens[1];
    title = `${p1} & ${p2} ${matchedType}`;
  } else if (partyTokens.length === 1 && matchedType) {
    title = `${partyTokens[0]} ${matchedType}`;
  } else if (matchedType) {
    const prefix = segments.slice(0, 2).join(' ');
    title = prefix.toLowerCase().includes(matchedType.toLowerCase().slice(0, 5))
      ? matchedType
      : `${prefix} ${matchedType}`;
  } else {
    title = segments
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  title = title.replace(/\s+/g, ' ').replace(/& &/g, '&').trim();

  if (!title || title.length < 3) {
    title = rawStem.replace(/[_\-]+/g, ' ').trim();
  }

  // 6. Handle multiple sessions on the same contract uniquely
  if (sessionIndex > 1) {
    return `${title} (Audit ${sessionIndex})`;
  }

  return title;
}
