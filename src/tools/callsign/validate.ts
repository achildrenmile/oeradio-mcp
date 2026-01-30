/**
 * Callsign Validation
 *
 * Validates callsigns against Austrian amateur radio rules
 */

import { ValidationResult, DISTRICTS, LICENSE_CLASSES } from './types.js';

/**
 * Valid suffix lengths by type
 */
const SUFFIX_RULES = {
  personal: { min: 2, max: 3 }, // OE8ML, OE8YML
  club: { min: 2, max: 4 },     // OE8XKK, OE8XKVC
};

/**
 * Parse an Austrian callsign
 */
export function parseCallsign(
  callsign: string
): { prefix: string; district: number; suffix: string } | null {
  const normalized = callsign.toUpperCase().trim();

  // Match Austrian callsign pattern: OE + digit + 2-4 letters
  const match = normalized.match(/^(OE)(\d)([A-Z]{2,4})$/);

  if (!match) {
    return null;
  }

  const [, prefix, districtStr, suffix] = match;
  const district = parseInt(districtStr, 10);

  return { prefix, district, suffix };
}

/**
 * Check if a suffix indicates a club station
 */
export function isClubSuffix(suffix: string): boolean {
  return suffix.startsWith('X');
}

/**
 * Validate an Austrian callsign
 */
export function validateCallsign(callsign: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const normalized = callsign.toUpperCase().trim();

  // Basic format check
  if (!normalized) {
    return {
      valid: false,
      errors: ['Rufzeichen darf nicht leer sein'],
      warnings: [],
      parsed: null,
    };
  }

  // Check for invalid characters
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    errors.push('Rufzeichen enthält ungültige Zeichen (nur A-Z und 0-9 erlaubt)');
  }

  // Parse the callsign
  const parsed = parseCallsign(normalized);

  if (!parsed) {
    // Try to give specific error
    if (!normalized.startsWith('OE')) {
      errors.push('Rufzeichen muss mit "OE" beginnen (österreichisches Präfix)');
    } else if (normalized.length < 4) {
      errors.push('Rufzeichen zu kurz (mindestens 4 Zeichen: OE + Bezirk + Suffix)');
    } else if (normalized.length > 7) {
      errors.push('Rufzeichen zu lang (maximal 7 Zeichen: OE + Bezirk + 4-Buchstaben-Suffix)');
    } else {
      const secondChar = normalized[2];
      if (!/\d/.test(secondChar)) {
        errors.push(`Bezirksziffer fehlt oder ungültig: "${secondChar}" (muss 0-9 sein)`);
      } else {
        const suffix = normalized.slice(3);
        if (suffix.length < 2) {
          errors.push('Suffix zu kurz (mindestens 2 Buchstaben)');
        } else if (suffix.length > 4) {
          errors.push('Suffix zu lang (maximal 4 Buchstaben)');
        } else if (!/^[A-Z]+$/.test(suffix)) {
          errors.push('Suffix enthält ungültige Zeichen (nur Buchstaben A-Z erlaubt)');
        }
      }
    }

    return {
      valid: false,
      errors,
      warnings,
      parsed: null,
    };
  }

  // Validate district
  if (parsed.district < 0 || parsed.district > 9) {
    errors.push(`Ungültiger Bezirk: ${parsed.district} (muss 0-9 sein)`);
  } else if (parsed.district === 0) {
    warnings.push('Bezirk 0 ist für Spezialfälle reserviert (z.B. außerhalb Hoheitsgebiet)');
  }

  // Check suffix rules
  const isClub = isClubSuffix(parsed.suffix);
  const rules = isClub ? SUFFIX_RULES.club : SUFFIX_RULES.personal;

  if (parsed.suffix.length < rules.min) {
    errors.push(`Suffix zu kurz (mindestens ${rules.min} Buchstaben für ${isClub ? 'Klub' : 'Personal'}rufzeichen)`);
  }

  if (parsed.suffix.length > rules.max) {
    errors.push(`Suffix zu lang (maximal ${rules.max} Buchstaben für ${isClub ? 'Klub' : 'Personal'}rufzeichen)`);
  }

  // Club station warnings
  if (isClub) {
    warnings.push('Klubrufzeichen (Suffix beginnt mit X)');
  }

  // Check for potentially confusing suffixes
  const confusingSuffixes = ['SOS', 'XXX', 'QRZ', 'CQ'];
  if (confusingSuffixes.includes(parsed.suffix)) {
    warnings.push(`Suffix "${parsed.suffix}" könnte mit Betriebsabkürzungen verwechselt werden`);
  }

  // Check for numeric-looking letters
  if (/[OI]/.test(parsed.suffix)) {
    warnings.push('Suffix enthält O oder I - kann mit 0 oder 1 verwechselt werden');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed,
  };
}

/**
 * Get district name
 */
export function getDistrictName(district: number): string {
  return DISTRICTS[district] || 'Unbekannt';
}

/**
 * Get license class description
 */
export function getLicenseClassName(licenseClass: number): string {
  return LICENSE_CLASSES[licenseClass] || 'Unbekannt';
}

/**
 * Format a callsign for display
 */
export function formatCallsign(callsign: string): string {
  return callsign.toUpperCase().trim();
}

/**
 * Validate a suffix (without prefix and district)
 */
export function validateSuffix(suffix: string, isClub: boolean = false): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const normalized = suffix.toUpperCase().trim();

  if (!normalized) {
    return { valid: false, errors: ['Suffix darf nicht leer sein'] };
  }

  if (!/^[A-Z]+$/.test(normalized)) {
    errors.push('Suffix darf nur Buchstaben A-Z enthalten');
  }

  const rules = isClub ? SUFFIX_RULES.club : SUFFIX_RULES.personal;

  if (normalized.length < rules.min) {
    errors.push(`Suffix zu kurz (mindestens ${rules.min} Buchstaben)`);
  }

  if (normalized.length > rules.max) {
    errors.push(`Suffix zu lang (maximal ${rules.max} Buchstaben)`);
  }

  if (isClub && !normalized.startsWith('X')) {
    errors.push('Klubrufzeichen-Suffix muss mit X beginnen');
  }

  if (!isClub && normalized.startsWith('X')) {
    errors.push('Persönliches Rufzeichen-Suffix darf nicht mit X beginnen');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
