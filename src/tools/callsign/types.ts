/**
 * Callsign Tool Types
 *
 * Types for the MCP callsign lookup, validation, and suggestion tools
 */

import { ParsedCallsign, CallsignDatabase } from './parser/types.js';

// Re-export parser types
export { ParsedCallsign, CallsignDatabase } from './parser/types.js';

/**
 * Data source for callsign information
 */
export type CallsignSource = 'fb' | 'qrz' | 'hamqth' | 'not_found';

/**
 * Extended callsign entry with source information
 */
export interface CallsignEntry extends ParsedCallsign {
  source: CallsignSource;
  lastUpdated: string;
}

/**
 * Result of a callsign lookup
 */
export interface LookupResult {
  exists: boolean;
  data?: CallsignEntry;
  source: CallsignSource;
  warning?: string;
}

/**
 * Result of an availability check
 */
export interface AvailabilityResult {
  suffix: string;
  available: boolean;
  available_districts: number[];
  taken_districts: number[];
  taken_by?: {
    district: number;
    callsign: string;
    name: string;
  }[];
}

/**
 * Callsign suggestion with scoring
 */
export interface CallsignSuggestion {
  suffix: string;
  available_districts: number[];
  phonetic_score: number;
  cw_score: number;
  derivation: string;
}

/**
 * Options for suggestion generation
 */
export interface SuggestOptions {
  name: string;
  preferred_district?: number;
  max_results: number;
  exclude_club: boolean;
  min_phonetic_score: number;
}

/**
 * Result of callsign validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: {
    prefix: string;
    district: number;
    suffix: string;
  } | null;
}

/**
 * Austrian district information
 */
export const DISTRICTS: Record<number, string> = {
  0: 'Spezial (außerhalb Hoheitsgebiet)',
  1: 'Wien',
  2: 'Salzburg',
  3: 'Niederösterreich',
  4: 'Burgenland',
  5: 'Oberösterreich',
  6: 'Steiermark',
  7: 'Tirol',
  8: 'Kärnten',
  9: 'Vorarlberg',
};

/**
 * License class information
 */
export const LICENSE_CLASSES: Record<number, string> = {
  1: 'CEPT Klasse 1 (volle Rechte)',
  3: 'CEPT Klasse 3 (eingeschränkt)',
  4: 'Einsteiger (nur UKW)',
};

/**
 * Configuration for external API sources
 */
export interface CallsignConfig {
  dataPath: string;
  qrz?: {
    username: string;
    password: string;
  };
  hamqth?: {
    username?: string;
    password?: string;
  };
  cacheEnabled: boolean;
  cacheTTL: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CallsignConfig = {
  dataPath: './data/callsigns_oe.json',
  cacheEnabled: true,
  cacheTTL: 3600, // 1 hour
};
