/**
 * Callsign Availability Check
 *
 * Check if a suffix is available in Austrian districts
 */

import { checkSuffixAvailability } from './sources/local.js';
import { validateSuffix } from './validate.js';
import { AvailabilityResult, DISTRICTS } from './types.js';

/**
 * Check if a suffix is available (in any or specific district)
 */
export async function checkAvailability(
  suffix: string,
  district?: number
): Promise<AvailabilityResult> {
  const normalized = suffix.toUpperCase().trim();

  // Validate suffix first
  const isClub = normalized.startsWith('X');
  const validation = validateSuffix(normalized, isClub);

  if (!validation.valid) {
    return {
      suffix: normalized,
      available: false,
      available_districts: [],
      taken_districts: [],
      taken_by: [],
    };
  }

  // Check which districts to query
  const districtsToCheck = district !== undefined
    ? [district]
    : [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Check availability in database
  const result = await checkSuffixAvailability(normalized, districtsToCheck);

  return {
    suffix: normalized,
    available: result.available_districts.length > 0,
    available_districts: result.available_districts,
    taken_districts: result.taken_districts,
    taken_by: result.taken_by,
  };
}

/**
 * Check availability of multiple suffixes at once
 */
export async function checkMultipleAvailability(
  suffixes: string[],
  district?: number
): Promise<Map<string, AvailabilityResult>> {
  const results = new Map<string, AvailabilityResult>();

  // Process in parallel
  const promises = suffixes.map(async (suffix) => {
    const result = await checkAvailability(suffix, district);
    return { suffix: suffix.toUpperCase(), result };
  });

  const resolved = await Promise.all(promises);
  for (const { suffix, result } of resolved) {
    results.set(suffix, result);
  }

  return results;
}

/**
 * Find all available 2-letter suffixes in a district
 */
export async function findAvailable2LetterSuffixes(
  district: number,
  options: {
    excludeClub?: boolean;
    includeClub?: boolean;
  } = {}
): Promise<string[]> {
  const available: string[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Generate all 2-letter combinations
  const suffixes: string[] = [];
  for (const first of letters) {
    // Skip X if excluding club suffixes
    if (options.excludeClub && first === 'X') continue;
    // If includeClub only, only check X suffixes
    if (options.includeClub && first !== 'X') continue;

    for (const second of letters) {
      suffixes.push(first + second);
    }
  }

  // Check in batches
  const results = await checkMultipleAvailability(suffixes, district);

  for (const [suffix, result] of results) {
    if (result.available) {
      available.push(suffix);
    }
  }

  return available.sort();
}

/**
 * Get availability summary for a suffix
 */
export function formatAvailabilityResult(result: AvailabilityResult): string {
  const lines: string[] = [];

  lines.push(`Suffix: ${result.suffix}`);
  lines.push(`Verfügbar: ${result.available ? 'Ja' : 'Nein'}`);

  if (result.available_districts.length > 0) {
    const districts = result.available_districts
      .map(d => `OE${d} (${DISTRICTS[d]})`)
      .join(', ');
    lines.push(`Freie Bezirke: ${districts}`);
  }

  if (result.taken_districts.length > 0) {
    lines.push(`Belegte Bezirke:`);
    for (const taken of result.taken_by || []) {
      lines.push(`  - ${taken.callsign}: ${taken.name}`);
    }
  }

  return lines.join('\n');
}
