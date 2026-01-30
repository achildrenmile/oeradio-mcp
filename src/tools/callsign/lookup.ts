/**
 * Callsign Lookup with Fallback Chain
 *
 * 1. Local database (fb.gv.at official list)
 * 2. QRZ.com API (if configured)
 * 3. HamQTH API (free fallback)
 */

import { lookupLocal } from './sources/local.js';
import { lookupQRZ, isQRZConfigured } from './sources/qrz.js';
import { lookupHamQTH } from './sources/hamqth.js';
import { LookupResult, CallsignConfig, DEFAULT_CONFIG } from './types.js';

// Simple in-memory cache
const lookupCache = new Map<string, { result: LookupResult; timestamp: number }>();

/**
 * Configuration for the lookup module
 */
let config: CallsignConfig = { ...DEFAULT_CONFIG };

/**
 * Set configuration for lookups
 */
export function setConfig(newConfig: Partial<CallsignConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): CallsignConfig {
  return { ...config };
}

/**
 * Check cache for recent lookup
 */
function getCachedLookup(callsign: string): LookupResult | null {
  if (!config.cacheEnabled) return null;

  const cached = lookupCache.get(callsign.toUpperCase());
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > config.cacheTTL * 1000) {
    lookupCache.delete(callsign.toUpperCase());
    return null;
  }

  return cached.result;
}

/**
 * Store lookup result in cache
 */
function setCachedLookup(callsign: string, result: LookupResult): void {
  if (!config.cacheEnabled) return;

  lookupCache.set(callsign.toUpperCase(), {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Main lookup function with fallback chain
 *
 * Priority:
 * 1. Local fb.gv.at database (authoritative for Austria)
 * 2. QRZ.com (if credentials configured)
 * 3. HamQTH (free, no credentials needed)
 *
 * If found in external sources but NOT in local database,
 * a warning is added about potential unlicensed operation.
 */
export async function lookupCallsign(
  callsign: string,
  options: {
    skipCache?: boolean;
    localOnly?: boolean;
  } = {}
): Promise<LookupResult> {
  const normalized = callsign.toUpperCase().trim();

  // Validate basic format
  if (!normalized.match(/^[A-Z0-9]{3,10}$/)) {
    return {
      exists: false,
      source: 'not_found',
      warning: 'Invalid callsign format',
    };
  }

  // Check cache
  if (!options.skipCache) {
    const cached = getCachedLookup(normalized);
    if (cached) {
      return cached;
    }
  }

  // 1. Local database (authoritative)
  const localResult = await lookupLocal(normalized);
  if (localResult.exists) {
    setCachedLookup(normalized, localResult);
    return localResult;
  }

  // If local only requested, stop here
  if (options.localOnly) {
    return localResult;
  }

  // Check if this is an Austrian callsign
  const isOeCallsign = normalized.startsWith('OE');

  // 2. QRZ.com API (if configured)
  if (isQRZConfigured(config.qrz)) {
    const qrzResult = await lookupQRZ(normalized, config.qrz!);
    if (qrzResult.exists) {
      // Add warning for OE callsigns not in official list
      if (isOeCallsign) {
        qrzResult.warning = 'Rufzeichen in QRZ.com gefunden aber NICHT in offizieller österreichischer Liste (fb.gv.at) - möglicherweise Schwarzfunker, abgelaufene Lizenz oder veraltete QRZ-Daten';
      }
      setCachedLookup(normalized, qrzResult);
      return qrzResult;
    }
  }

  // 3. HamQTH API (free fallback)
  const hamqthResult = await lookupHamQTH(normalized, config.hamqth);
  if (hamqthResult.exists) {
    // Add warning for OE callsigns not in official list
    if (isOeCallsign) {
      hamqthResult.warning = 'Rufzeichen in HamQTH gefunden aber NICHT in offizieller österreichischer Liste (fb.gv.at) - möglicherweise Schwarzfunker, abgelaufene Lizenz oder veraltete Daten';
    }
    setCachedLookup(normalized, hamqthResult);
    return hamqthResult;
  }

  // Not found anywhere
  const notFoundResult: LookupResult = {
    exists: false,
    source: 'not_found',
  };
  setCachedLookup(normalized, notFoundResult);
  return notFoundResult;
}

/**
 * Batch lookup multiple callsigns
 */
export async function lookupMultiple(
  callsigns: string[],
  options: { skipCache?: boolean; localOnly?: boolean } = {}
): Promise<Map<string, LookupResult>> {
  const results = new Map<string, LookupResult>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  const queue = [...callsigns];

  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(cs => lookupCallsign(cs, options))
    );

    batch.forEach((cs, idx) => {
      results.set(cs.toUpperCase(), batchResults[idx]);
    });
  }

  return results;
}

/**
 * Clear the lookup cache
 */
export function clearCache(): void {
  lookupCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  enabled: boolean;
  ttlSeconds: number;
} {
  return {
    size: lookupCache.size,
    enabled: config.cacheEnabled,
    ttlSeconds: config.cacheTTL,
  };
}
