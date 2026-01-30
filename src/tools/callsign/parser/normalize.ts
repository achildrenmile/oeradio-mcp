/**
 * Data Normalization for Austrian Callsign List
 *
 * Normalizes and cleans parsed callsign data
 */

import { RawCallsignRow, ParsedCallsign } from './types.js';

/**
 * Normalize a raw callsign entry
 */
export function normalizeEntry(raw: RawCallsignRow): ParsedCallsign | null {
  // Parse callsign structure
  const callsignMatch = raw.callsign.match(/^(OE)([0-9])([A-Z]{1,4})$/);
  if (!callsignMatch) {
    console.warn(`Invalid callsign format: ${raw.callsign}`);
    return null;
  }

  const [, prefix, districtStr, suffix] = callsignMatch;
  const district = parseInt(districtStr, 10);

  // Check if entry is hidden
  const isHidden = raw.name === '*-*-*' || raw.name.includes('*-*-*');

  // Normalize name (unless hidden)
  const name = isHidden ? '' : normalizeName(raw.name);

  // Extract PLZ and QTH from location
  const { plz, qth } = parseLocation(raw.location);

  // Parse license class
  const licenseClass = parseInt(raw.licenseClass, 10) || 1;

  // Detect club stations (suffix starts with X)
  const isClub = suffix.startsWith('X');

  return {
    callsign: raw.callsign,
    prefix,
    district,
    suffix,
    name,
    qth: isHidden ? '' : qth,
    plz: isHidden ? '' : plz,
    address: isHidden ? '' : raw.address,
    licenseClass,
    isClub,
    isHidden,
  };
}

/**
 * Normalize a name from "LASTNAME FIRSTNAME TITLE" to "Firstname Lastname"
 */
export function normalizeName(name: string): string {
  if (!name || name === '*-*-*') return '';

  // Remove common titles
  const titles = [
    'ING', 'ING.', 'MAG', 'MAG.', 'DR', 'DR.', 'DIPL', 'DIPL.',
    'DIPL.-ING', 'DIPL.-ING.', 'JUN', 'JUN.', 'SEN', 'SEN.',
    'BAKK', 'BAKK.', 'BSC', 'BSC.', 'MSC', 'MSC.', 'MBA',
    'PROF', 'PROF.', 'UNIV.-PROF', 'UNIV.-PROF.', 'DKFM', 'DKFM.',
    'OING', 'OING.', 'BAUING', 'BAUING.', 'BMSTR', 'BMSTR.'
  ];

  const parts = name.split(/\s+/);
  const nameParts = parts.filter(p => !titles.includes(p.toUpperCase()));

  if (nameParts.length === 0) return name;

  if (nameParts.length >= 2) {
    // Assume: LASTNAME FIRSTNAME [MIDDLENAME...]
    const lastName = nameParts[0];
    const firstName = nameParts.slice(1).join(' ');

    return `${formatName(firstName)} ${formatName(lastName)}`;
  }

  // Single name part
  return formatName(nameParts[0]);
}

/**
 * Format a name part to Title Case
 */
function formatName(name: string): string {
  if (!name) return '';

  // Handle hyphenated names
  if (name.includes('-')) {
    return name.split('-').map(formatName).join('-');
  }

  // Handle special prefixes (von, van, de, etc.)
  const lowerPrefixes = ['von', 'van', 'de', 'der', 'den', 'du', 'la', 'le'];
  if (lowerPrefixes.includes(name.toLowerCase())) {
    return name.toLowerCase();
  }

  // Standard title case
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Parse location string into PLZ and QTH
 */
export function parseLocation(location: string): { plz: string; qth: string } {
  if (!location || location === '*-*-*') {
    return { plz: '', qth: '' };
  }

  // Pattern: "1234 City Name"
  const match = location.match(/^(\d{4})\s+(.+)$/);
  if (match) {
    return {
      plz: match[1],
      qth: match[2].trim(),
    };
  }

  // No PLZ found, return whole string as QTH
  return {
    plz: '',
    qth: location.trim(),
  };
}

/**
 * Batch normalize entries
 */
export function normalizeAll(rows: RawCallsignRow[]): ParsedCallsign[] {
  const results: ParsedCallsign[] = [];

  for (const row of rows) {
    const normalized = normalizeEntry(row);
    if (normalized) {
      results.push(normalized);
    }
  }

  return results;
}

/**
 * Deduplicate entries (keep first occurrence)
 */
export function deduplicateEntries(entries: ParsedCallsign[]): ParsedCallsign[] {
  const seen = new Set<string>();
  const unique: ParsedCallsign[] = [];

  for (const entry of entries) {
    if (!seen.has(entry.callsign)) {
      seen.add(entry.callsign);
      unique.push(entry);
    }
  }

  return unique;
}

/**
 * Sort entries by callsign
 */
export function sortEntries(entries: ParsedCallsign[]): ParsedCallsign[] {
  return [...entries].sort((a, b) => a.callsign.localeCompare(b.callsign));
}
