/**
 * Callsign Parser Types
 *
 * Types for parsing the Austrian callsign list PDF from fb.gv.at
 */

export interface RawCallsignRow {
  callsign: string;
  name: string;
  location: string;
  address: string;
  licenseClass: string;
}

export interface ParsedCallsign {
  callsign: string;
  prefix: string;
  district: number;
  suffix: string;
  name: string;
  qth: string;
  plz: string;
  address: string;
  licenseClass: number;
  isClub: boolean;
  isHidden: boolean;
}

export interface CallsignDatabase {
  version: string;
  sourceUrl: string;
  parsedAt: string;
  count: number;
  legalNotice: string;
  entries: ParsedCallsign[];
}

export interface ValidationStats {
  total: number;
  byDistrict: Record<number, number>;
  byLicenseClass: Record<number, number>;
  clubStations: number;
  hiddenEntries: number;
  duplicates: number;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: ValidationStats;
}
