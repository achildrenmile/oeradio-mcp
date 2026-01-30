/**
 * Local Callsign Database Source
 *
 * Lookups against the local fb.gv.at parsed database
 */

import { promises as fs } from 'fs';
import path from 'path';
import { CallsignDatabase, ParsedCallsign, CallsignEntry, LookupResult } from '../types.js';

let cachedDatabase: CallsignDatabase | null = null;
let cacheLoadedAt: number = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Get the database file path
 */
function getDataPath(): string {
  return path.join(process.cwd(), 'data', 'callsigns_oe.json');
}

/**
 * Load the callsign database from disk
 */
export async function loadDatabase(): Promise<CallsignDatabase> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedDatabase && (now - cacheLoadedAt) < CACHE_TTL) {
    return cachedDatabase;
  }

  const dataPath = getDataPath();

  try {
    const content = await fs.readFile(dataPath, 'utf-8');
    cachedDatabase = JSON.parse(content) as CallsignDatabase;
    cacheLoadedAt = now;
    return cachedDatabase;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Callsign database not found at ${dataPath}. Run 'npm run update-callsigns' first.`);
    }
    throw error;
  }
}

/**
 * Get database metadata
 */
export async function getDatabaseInfo(): Promise<{
  version: string;
  count: number;
  parsedAt: string;
  sourceUrl: string;
}> {
  const db = await loadDatabase();
  return {
    version: db.version,
    count: db.count,
    parsedAt: db.parsedAt,
    sourceUrl: db.sourceUrl,
  };
}

/**
 * Look up a callsign in the local database
 */
export async function lookupLocal(callsign: string): Promise<LookupResult> {
  const db = await loadDatabase();
  const normalized = callsign.toUpperCase().trim();

  const entry = db.entries.find(e => e.callsign === normalized);

  if (!entry) {
    return {
      exists: false,
      source: 'not_found',
    };
  }

  // Convert ParsedCallsign to CallsignEntry
  const callsignEntry: CallsignEntry = {
    ...entry,
    source: 'fb',
    lastUpdated: db.parsedAt,
  };

  return {
    exists: true,
    data: callsignEntry,
    source: 'fb',
  };
}

/**
 * Check if a suffix is taken in specific districts
 */
export async function checkSuffixAvailability(
  suffix: string,
  districts?: number[]
): Promise<{
  available_districts: number[];
  taken_districts: number[];
  taken_by: { district: number; callsign: string; name: string }[];
}> {
  const db = await loadDatabase();
  const normalizedSuffix = suffix.toUpperCase().trim();
  const districtsToCheck = districts || [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const taken_by: { district: number; callsign: string; name: string }[] = [];
  const taken_districts: number[] = [];
  const available_districts: number[] = [];

  for (const district of districtsToCheck) {
    const testCallsign = `OE${district}${normalizedSuffix}`;
    const entry = db.entries.find(e => e.callsign === testCallsign);

    if (entry) {
      taken_districts.push(district);
      taken_by.push({
        district,
        callsign: entry.callsign,
        name: entry.isHidden ? '[versteckt]' : entry.name,
      });
    } else {
      available_districts.push(district);
    }
  }

  return {
    available_districts,
    taken_districts,
    taken_by,
  };
}

/**
 * Search for callsigns matching a pattern
 */
export async function searchCallsigns(
  pattern: string,
  options: {
    limit?: number;
    district?: number;
    licenseClass?: number;
    clubOnly?: boolean;
  } = {}
): Promise<ParsedCallsign[]> {
  const db = await loadDatabase();
  const { limit = 50, district, licenseClass, clubOnly } = options;

  const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');

  let results = db.entries.filter(entry => {
    if (!regex.test(entry.callsign)) return false;
    if (district !== undefined && entry.district !== district) return false;
    if (licenseClass !== undefined && entry.licenseClass !== licenseClass) return false;
    if (clubOnly && !entry.isClub) return false;
    return true;
  });

  return results.slice(0, limit);
}

/**
 * Get all callsigns with a specific suffix (across all districts)
 */
export async function getCallsignsBySuffix(suffix: string): Promise<ParsedCallsign[]> {
  const db = await loadDatabase();
  const normalizedSuffix = suffix.toUpperCase().trim();

  return db.entries.filter(e => e.suffix === normalizedSuffix);
}

/**
 * Get statistics about the database
 */
export async function getDatabaseStats(): Promise<{
  total: number;
  byDistrict: Record<number, number>;
  byLicenseClass: Record<number, number>;
  clubStations: number;
  hiddenEntries: number;
}> {
  const db = await loadDatabase();

  const byDistrict: Record<number, number> = {};
  const byLicenseClass: Record<number, number> = {};
  let clubStations = 0;
  let hiddenEntries = 0;

  for (const entry of db.entries) {
    byDistrict[entry.district] = (byDistrict[entry.district] || 0) + 1;
    byLicenseClass[entry.licenseClass] = (byLicenseClass[entry.licenseClass] || 0) + 1;
    if (entry.isClub) clubStations++;
    if (entry.isHidden) hiddenEntries++;
  }

  return {
    total: db.entries.length,
    byDistrict,
    byLicenseClass,
    clubStations,
    hiddenEntries,
  };
}

/**
 * Clear the database cache
 */
export function clearCache(): void {
  cachedDatabase = null;
  cacheLoadedAt = 0;
}
