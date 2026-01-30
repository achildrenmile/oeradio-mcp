/**
 * Callsign Parser Module
 *
 * Exports all parser functionality for the Austrian callsign list
 */

export * from './types.js';
export * from './extract.js';
export * from './normalize.js';
export * from './validate.js';

import { promises as fs } from 'fs';
import path from 'path';
import { CallsignDatabase, ParsedCallsign } from './types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'callsigns_oe.json');

/**
 * Load the callsign database from disk
 */
export async function loadDatabase(): Promise<CallsignDatabase> {
  const content = await fs.readFile(DB_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save the callsign database to disk
 */
export async function saveDatabase(db: CallsignDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

/**
 * Lookup a callsign in the database
 */
export async function lookupCallsign(callsign: string): Promise<ParsedCallsign | null> {
  const db = await loadDatabase();
  const normalized = callsign.toUpperCase().trim();
  return db.entries.find(e => e.callsign === normalized) || null;
}

/**
 * Search callsigns by various criteria
 */
export async function searchCallsigns(options: {
  prefix?: string;
  district?: number;
  qth?: string;
  name?: string;
  limit?: number;
}): Promise<ParsedCallsign[]> {
  const db = await loadDatabase();
  let results = db.entries;

  if (options.prefix) {
    const prefix = options.prefix.toUpperCase();
    results = results.filter(e => e.callsign.startsWith(prefix));
  }

  if (options.district !== undefined) {
    results = results.filter(e => e.district === options.district);
  }

  if (options.qth) {
    const qth = options.qth.toLowerCase();
    results = results.filter(e => e.qth.toLowerCase().includes(qth));
  }

  if (options.name) {
    const name = options.name.toLowerCase();
    results = results.filter(e => e.name.toLowerCase().includes(name));
  }

  if (options.limit && options.limit > 0) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Get database statistics
 */
export async function getStatistics(): Promise<{
  total: number;
  byDistrict: Record<number, number>;
  byLicenseClass: Record<number, number>;
  clubStations: number;
  lastUpdate: string;
}> {
  const db = await loadDatabase();

  const byDistrict: Record<number, number> = {};
  const byLicenseClass: Record<number, number> = {};
  let clubStations = 0;

  for (const entry of db.entries) {
    byDistrict[entry.district] = (byDistrict[entry.district] || 0) + 1;
    byLicenseClass[entry.licenseClass] = (byLicenseClass[entry.licenseClass] || 0) + 1;
    if (entry.isClub) clubStations++;
  }

  return {
    total: db.count,
    byDistrict,
    byLicenseClass,
    clubStations,
    lastUpdate: db.parsedAt,
  };
}
