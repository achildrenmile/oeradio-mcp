/**
 * Validation for Austrian Callsign Database
 *
 * Validates the parsed callsign data for consistency and completeness
 */

import { CallsignDatabase, ParsedCallsign, ValidationReport, ValidationStats } from './types.js';

/**
 * Validate the complete callsign database
 */
export function validateDatabase(db: CallsignDatabase): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: ValidationStats = {
    total: db.entries.length,
    byDistrict: {},
    byLicenseClass: {},
    clubStations: 0,
    hiddenEntries: 0,
    duplicates: 0,
  };

  const seen = new Set<string>();

  for (const entry of db.entries) {
    // Check for duplicates
    if (seen.has(entry.callsign)) {
      errors.push(`Duplicate callsign: ${entry.callsign}`);
      stats.duplicates++;
    }
    seen.add(entry.callsign);

    // Validate callsign format
    if (!isValidCallsign(entry.callsign)) {
      errors.push(`Invalid callsign format: ${entry.callsign}`);
    }

    // Validate district matches callsign
    const expectedDistrict = parseInt(entry.callsign.charAt(2), 10);
    if (entry.district !== expectedDistrict) {
      errors.push(`District mismatch for ${entry.callsign}: expected ${expectedDistrict}, got ${entry.district}`);
    }

    // Validate license class
    if (entry.licenseClass < 1 || entry.licenseClass > 4) {
      warnings.push(`Unusual license class for ${entry.callsign}: ${entry.licenseClass}`);
    }

    // Validate suffix length
    if (entry.suffix.length < 1 || entry.suffix.length > 4) {
      warnings.push(`Unusual suffix length for ${entry.callsign}: ${entry.suffix}`);
    }

    // Collect statistics
    stats.byDistrict[entry.district] = (stats.byDistrict[entry.district] || 0) + 1;
    stats.byLicenseClass[entry.licenseClass] = (stats.byLicenseClass[entry.licenseClass] || 0) + 1;
    if (entry.isClub) stats.clubStations++;
    if (entry.isHidden) stats.hiddenEntries++;
  }

  // Plausibility checks

  // Minimum expected entries
  if (db.entries.length < 5000) {
    warnings.push(`Unusually low entry count: ${db.entries.length} (expected ~6000+)`);
  }

  // All districts should be represented
  for (let d = 1; d <= 9; d++) {
    if (!stats.byDistrict[d]) {
      errors.push(`No entries for district ${d}`);
    } else if (stats.byDistrict[d] < 100) {
      warnings.push(`Very few entries for district ${d}: ${stats.byDistrict[d]}`);
    }
  }

  // Check for unexpected districts (0 is used for special callsigns)
  for (const district of Object.keys(stats.byDistrict)) {
    const d = parseInt(district, 10);
    if (d < 0 || d > 9) {
      errors.push(`Invalid district number: ${d}`);
    }
  }

  // License class distribution check
  if (!stats.byLicenseClass[1] || stats.byLicenseClass[1] < 1000) {
    warnings.push(`Unusually few class 1 licenses: ${stats.byLicenseClass[1] || 0}`);
  }

  // Hidden entries shouldn't be majority
  const hiddenPercent = (stats.hiddenEntries / stats.total) * 100;
  if (hiddenPercent > 30) {
    warnings.push(`High percentage of hidden entries: ${hiddenPercent.toFixed(1)}%`);
  }

  return { errors, warnings, stats };
}

/**
 * Validate a single callsign format
 */
export function isValidCallsign(callsign: string): boolean {
  // Austrian callsign format: OE + digit (0-9) + 1-4 letters
  return /^OE[0-9][A-Z]{1,4}$/.test(callsign);
}

/**
 * Validate a single entry
 */
export function validateEntry(entry: ParsedCallsign): string[] {
  const errors: string[] = [];

  if (!isValidCallsign(entry.callsign)) {
    errors.push('Invalid callsign format');
  }

  if (entry.district < 0 || entry.district > 9) {
    errors.push('Invalid district number');
  }

  if (entry.licenseClass < 1 || entry.licenseClass > 4) {
    errors.push('Invalid license class');
  }

  if (!entry.isHidden) {
    if (!entry.name || entry.name.length < 2) {
      errors.push('Missing or invalid name');
    }
  }

  return errors;
}

/**
 * Generate a validation summary report
 */
export function generateReport(validation: ValidationReport): string {
  const lines: string[] = [];

  lines.push('=== Callsign Database Validation Report ===\n');

  // Statistics
  lines.push('Statistics:');
  lines.push(`  Total entries: ${validation.stats.total}`);
  lines.push(`  Club stations: ${validation.stats.clubStations}`);
  lines.push(`  Hidden entries: ${validation.stats.hiddenEntries}`);
  lines.push(`  Duplicates: ${validation.stats.duplicates}`);
  lines.push('');

  lines.push('By District:');
  for (let d = 1; d <= 9; d++) {
    const count = validation.stats.byDistrict[d] || 0;
    lines.push(`  OE${d}: ${count}`);
  }
  if (validation.stats.byDistrict[0]) {
    lines.push(`  OE0: ${validation.stats.byDistrict[0]}`);
  }
  lines.push('');

  lines.push('By License Class:');
  for (let c = 1; c <= 4; c++) {
    const count = validation.stats.byLicenseClass[c] || 0;
    lines.push(`  Class ${c}: ${count}`);
  }
  lines.push('');

  // Errors
  if (validation.errors.length > 0) {
    lines.push(`Errors (${validation.errors.length}):`);
    for (const error of validation.errors.slice(0, 20)) {
      lines.push(`  - ${error}`);
    }
    if (validation.errors.length > 20) {
      lines.push(`  ... and ${validation.errors.length - 20} more`);
    }
    lines.push('');
  }

  // Warnings
  if (validation.warnings.length > 0) {
    lines.push(`Warnings (${validation.warnings.length}):`);
    for (const warning of validation.warnings.slice(0, 20)) {
      lines.push(`  - ${warning}`);
    }
    if (validation.warnings.length > 20) {
      lines.push(`  ... and ${validation.warnings.length - 20} more`);
    }
    lines.push('');
  }

  // Summary
  lines.push('Summary:');
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    lines.push('  All checks passed!');
  } else if (validation.errors.length === 0) {
    lines.push(`  Passed with ${validation.warnings.length} warning(s)`);
  } else {
    lines.push(`  Failed with ${validation.errors.length} error(s) and ${validation.warnings.length} warning(s)`);
  }

  return lines.join('\n');
}
