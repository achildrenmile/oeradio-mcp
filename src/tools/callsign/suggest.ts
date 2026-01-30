/**
 * Callsign Suggestion Algorithm
 *
 * Generates callsign suffix suggestions based on names and preferences
 */

import { checkSuffixAvailability } from './sources/local.js';
import { CallsignSuggestion, SuggestOptions } from './types.js';

/**
 * Morse code character weights (shorter = better for CW)
 * E=1, T=1, A=2, I=2, M=2, N=2, etc.
 */
const MORSE_WEIGHTS: Record<string, number> = {
  E: 1, T: 1,
  A: 2, I: 2, M: 2, N: 2,
  D: 3, G: 3, K: 3, O: 3, R: 3, S: 3, U: 3, W: 3,
  B: 4, C: 4, F: 4, H: 4, J: 4, L: 4, P: 4, Q: 4, V: 4, X: 4, Y: 4, Z: 4,
};

/**
 * Calculate CW-friendliness score (0-1, higher is better)
 */
function calculateCwScore(suffix: string): number {
  if (!suffix) return 0;

  let totalWeight = 0;
  for (const char of suffix.toUpperCase()) {
    totalWeight += MORSE_WEIGHTS[char] || 4;
  }

  // Max weight is 4 per char, normalize to 0-1
  const maxWeight = suffix.length * 4;
  const minWeight = suffix.length * 1;

  // Invert so lower weight = higher score
  const normalized = 1 - ((totalWeight - minWeight) / (maxWeight - minWeight));
  return Math.round(normalized * 100) / 100;
}

/**
 * Calculate phonetic score (how easy to pronounce)
 * Factors: vowel-consonant pattern, no difficult combinations
 */
function calculatePhoneticScore(suffix: string): number {
  if (!suffix) return 0;

  const upper = suffix.toUpperCase();
  let score = 1.0;

  // Vowels make pronunciation easier
  const vowels = (upper.match(/[AEIOU]/g) || []).length;
  const consonants = upper.length - vowels;

  // Ideal: at least one vowel, not all vowels
  if (vowels === 0) {
    score -= 0.3; // No vowels is hard to pronounce
  } else if (vowels === upper.length) {
    score -= 0.1; // All vowels is slightly odd
  } else {
    score += 0.1 * Math.min(vowels, 2); // Bonus for vowels
  }

  // Difficult letter combinations
  const difficultPatterns = [
    /[XQZ]{2,}/, // Multiple difficult letters
    /[BCDGKPT]{3,}/, // Three+ consonants in a row
    /[AEIOU]{3,}/, // Three+ vowels in a row
  ];

  for (const pattern of difficultPatterns) {
    if (pattern.test(upper)) {
      score -= 0.2;
    }
  }

  // Confusing letters (O/0, I/1)
  if (/[OI]/.test(upper)) {
    score -= 0.1;
  }

  // Similar sounding letters together
  const similarPatterns = [/MN/, /NM/, /BD/, /DB/, /PB/, /BP/, /FV/, /VF/];
  for (const pattern of similarPatterns) {
    if (pattern.test(upper)) {
      score -= 0.1;
    }
  }

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Generate suffix candidates from a name
 */
function generateCandidatesFromName(
  name: string,
  excludeClub: boolean
): { suffix: string; derivation: string }[] {
  const candidates: { suffix: string; derivation: string }[] = [];
  const seen = new Set<string>();

  // Clean and split name
  const cleanName = name.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(p => p.length > 0);

  if (parts.length === 0) return candidates;

  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

  const addCandidate = (suffix: string, derivation: string) => {
    const upper = suffix.toUpperCase();
    if (upper.length < 2 || upper.length > 3) return;
    if (!/^[A-Z]+$/.test(upper)) return;
    if (excludeClub && upper.startsWith('X')) return;
    if (seen.has(upper)) return;
    seen.add(upper);
    candidates.push({ suffix: upper, derivation });
  };

  // 1. Initials (if two names)
  if (firstName && lastName) {
    // Two initials
    addCandidate(firstName[0] + lastName[0], 'Initialen');

    // Three letter variants
    if (firstName.length >= 2) {
      addCandidate(firstName.substring(0, 2) + lastName[0], 'Vorname + Initial');
    }
    if (lastName.length >= 2) {
      addCandidate(firstName[0] + lastName.substring(0, 2), 'Initial + Nachname');
    }
  }

  // 2. First name variants
  if (firstName.length >= 2) {
    addCandidate(firstName.substring(0, 2), 'Vorname (2 Buchstaben)');
  }
  if (firstName.length >= 3) {
    addCandidate(firstName.substring(0, 3), 'Vorname (3 Buchstaben)');
  }

  // 3. Last name variants
  if (lastName.length >= 2) {
    addCandidate(lastName.substring(0, 2), 'Nachname (2 Buchstaben)');
  }
  if (lastName.length >= 3) {
    addCandidate(lastName.substring(0, 3), 'Nachname (3 Buchstaben)');
  }

  // 4. Consonant extraction
  const firstConsonants = firstName.replace(/[AEIOU]/g, '').substring(0, 3);
  if (firstConsonants.length >= 2) {
    addCandidate(firstConsonants.substring(0, 2), 'Konsonanten Vorname');
    if (firstConsonants.length >= 3) {
      addCandidate(firstConsonants, 'Konsonanten Vorname');
    }
  }

  if (lastName) {
    const lastConsonants = lastName.replace(/[AEIOU]/g, '').substring(0, 3);
    if (lastConsonants.length >= 2) {
      addCandidate(lastConsonants.substring(0, 2), 'Konsonanten Nachname');
    }
  }

  // 5. Creative combinations
  if (firstName.length >= 1 && lastName.length >= 2) {
    // Y + Nachname (YML style)
    addCandidate('Y' + lastName.substring(0, 2), 'Y + Nachname');
  }

  // 6. Phonetic variations for common names
  const phoneticMap: Record<string, string[]> = {
    'MICHAEL': ['MIC', 'MIK', 'MHL'],
    'THOMAS': ['TOM', 'THS', 'TMS'],
    'STEFAN': ['STF', 'STE', 'STN'],
    'ANDREAS': ['AND', 'ADS', 'ANS'],
    'CHRISTIAN': ['CHR', 'CRS', 'CHN'],
    'MARTIN': ['MAR', 'MRT', 'MTN'],
    'PETER': ['PET', 'PTR', 'PTE'],
    'FRANZ': ['FRZ', 'FRA', 'FNZ'],
    'WOLFGANG': ['WOL', 'WFG', 'WLF'],
    'HANS': ['HNS', 'HAS', 'HAN'],
    'JOSEF': ['JOS', 'JSF', 'JOE'],
    'KARL': ['KRL', 'KAR', 'KAL'],
    'HELMUT': ['HLM', 'HMT', 'HEL'],
  };

  const phoneticVariants = phoneticMap[firstName];
  if (phoneticVariants) {
    for (const variant of phoneticVariants) {
      addCandidate(variant, `Phonetische Variante von ${firstName}`);
    }
  }

  return candidates;
}

/**
 * Generate callsign suggestions
 */
export async function generateSuggestions(
  options: SuggestOptions
): Promise<CallsignSuggestion[]> {
  const {
    name,
    preferred_district,
    max_results = 10,
    exclude_club = true,
    min_phonetic_score = 0.5,
  } = options;

  // Generate candidates from name
  const candidates = generateCandidatesFromName(name, exclude_club);

  // Score and filter candidates
  const scored: CallsignSuggestion[] = [];

  for (const { suffix, derivation } of candidates) {
    const phonetic_score = calculatePhoneticScore(suffix);
    const cw_score = calculateCwScore(suffix);

    // Skip if below minimum phonetic score
    if (phonetic_score < min_phonetic_score) continue;

    // Check availability
    const availability = await checkSuffixAvailability(
      suffix,
      preferred_district ? [preferred_district] : undefined
    );

    // Skip if not available anywhere
    if (availability.available_districts.length === 0) continue;

    scored.push({
      suffix,
      available_districts: availability.available_districts,
      phonetic_score,
      cw_score,
      derivation,
    });
  }

  // Sort by combined score (phonetic + CW + district preference)
  scored.sort((a, b) => {
    // Prefer suggestions available in preferred district
    if (preferred_district) {
      const aInPreferred = a.available_districts.includes(preferred_district);
      const bInPreferred = b.available_districts.includes(preferred_district);
      if (aInPreferred && !bInPreferred) return -1;
      if (!aInPreferred && bInPreferred) return 1;
    }

    // Then by combined score
    const aScore = a.phonetic_score * 0.6 + a.cw_score * 0.4;
    const bScore = b.phonetic_score * 0.6 + b.cw_score * 0.4;
    return bScore - aScore;
  });

  return scored.slice(0, max_results);
}

/**
 * Generate random available suffixes
 */
export async function generateRandomSuggestions(
  count: number,
  options: {
    district?: number;
    length?: 2 | 3;
    excludeClub?: boolean;
  } = {}
): Promise<CallsignSuggestion[]> {
  const { district, length = 3, excludeClub = true } = options;

  const letters = excludeClub
    ? 'ABCDEFGHIJKLMNOPQRSTUVWYZ' // Exclude X
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const suggestions: CallsignSuggestion[] = [];
  const tried = new Set<string>();
  const maxAttempts = count * 20;
  let attempts = 0;

  while (suggestions.length < count && attempts < maxAttempts) {
    attempts++;

    // Generate random suffix
    let suffix = '';
    for (let i = 0; i < length; i++) {
      suffix += letters[Math.floor(Math.random() * letters.length)];
    }

    if (tried.has(suffix)) continue;
    tried.add(suffix);

    // Check availability
    const availability = await checkSuffixAvailability(
      suffix,
      district ? [district] : undefined
    );

    if (availability.available_districts.length === 0) continue;

    suggestions.push({
      suffix,
      available_districts: availability.available_districts,
      phonetic_score: calculatePhoneticScore(suffix),
      cw_score: calculateCwScore(suffix),
      derivation: 'Zufällig generiert',
    });
  }

  return suggestions;
}
