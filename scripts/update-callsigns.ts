#!/usr/bin/env npx ts-node

/**
 * Update Callsign Database
 *
 * Downloads the Austrian callsign list PDF from fb.gv.at,
 * parses it, and updates the local database.
 *
 * Usage: npm run update-callsigns
 */

import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import { extractFromPdf } from '../src/tools/callsign/parser/extract.js';
import { normalizeAll, deduplicateEntries, sortEntries } from '../src/tools/callsign/parser/normalize.js';
import { validateDatabase, generateReport } from '../src/tools/callsign/parser/validate.js';
import { CallsignDatabase } from '../src/tools/callsign/parser/types.js';

// Configuration
const PDF_URL = 'https://www.fb.gv.at/dam/jcr:7a8aeec6-bbf2-4d7d-ab3b-5335ebc7b8ed/Rufzeichenliste_AT_Stand_010725.pdf';
const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'callsigns_oe.json');
const BACKUP_FILE = path.join(DATA_DIR, 'callsigns_oe_backup.json');

const LEGAL_NOTICE = `Diese Daten stammen aus der öffentlichen Rufzeichenliste des österreichischen Fernmeldebüros (fb.gv.at).
Die Verwendung ist gemäß § 150 TKG 2021 nur für Amateurfunkzwecke gestattet.
Eine kommerzielle Nutzung oder Weitergabe an Dritte ist nicht erlaubt.`;

/**
 * Download PDF from URL
 */
async function downloadPdf(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadPdf(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Extract version from URL
 */
function extractVersionFromUrl(url: string): string {
  // URL contains "Stand_DDMMYY" -> "20YY-MM-DD"
  const match = url.match(/Stand_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, day, month, year] = match;
    return `20${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Main update function
 */
async function main() {
  console.log('=== Austrian Callsign Database Update ===\n');

  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Create backup of existing database
    try {
      const existingData = await fs.readFile(OUTPUT_FILE, 'utf-8');
      await fs.writeFile(BACKUP_FILE, existingData);
      console.log('[OK] Backup created');
    } catch {
      console.log('[INFO] No existing database to backup');
    }

    // Download PDF
    console.log('[...] Downloading PDF from fb.gv.at...');
    const pdfBuffer = await downloadPdf(PDF_URL);
    console.log(`[OK] Downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Parse PDF
    console.log('[...] Parsing PDF...');
    const rawRows = await extractFromPdf(pdfBuffer);
    console.log(`[OK] Extracted ${rawRows.length} raw rows`);

    // Normalize entries
    console.log('[...] Normalizing entries...');
    let entries = normalizeAll(rawRows);
    console.log(`[OK] Normalized ${entries.length} entries`);

    // Deduplicate
    const beforeDedup = entries.length;
    entries = deduplicateEntries(entries);
    if (entries.length < beforeDedup) {
      console.log(`[INFO] Removed ${beforeDedup - entries.length} duplicates`);
    }

    // Sort
    entries = sortEntries(entries);
    console.log('[OK] Sorted entries');

    // Create database object
    const database: CallsignDatabase = {
      version: extractVersionFromUrl(PDF_URL),
      sourceUrl: PDF_URL,
      parsedAt: new Date().toISOString(),
      count: entries.length,
      legalNotice: LEGAL_NOTICE,
      entries,
    };

    // Validate
    console.log('[...] Validating...');
    const validation = validateDatabase(database);

    // Print validation report
    console.log('\n' + generateReport(validation));

    // Check for critical errors
    if (validation.errors.length > 0) {
      console.error('\n[ERROR] Validation failed with errors');

      // Restore backup
      try {
        const backup = await fs.readFile(BACKUP_FILE, 'utf-8');
        await fs.writeFile(OUTPUT_FILE, backup);
        console.log('[OK] Restored from backup');
      } catch {
        console.warn('[WARN] No backup available to restore');
      }

      process.exit(1);
    }

    // Save database
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(database, null, 2));
    console.log(`\n[OK] Saved to ${OUTPUT_FILE}`);

    // Print summary
    console.log('\n=== Update Complete ===');
    console.log(`Version: ${database.version}`);
    console.log(`Entries: ${database.count}`);
    console.log(`File size: ${(JSON.stringify(database).length / 1024).toFixed(1)} KB`);

  } catch (error) {
    console.error('\n[ERROR] Update failed:', error);

    // Try to restore backup
    try {
      const backup = await fs.readFile(BACKUP_FILE, 'utf-8');
      await fs.writeFile(OUTPUT_FILE, backup);
      console.log('[OK] Restored from backup');
    } catch {
      console.warn('[WARN] No backup available to restore');
    }

    process.exit(1);
  }
}

// Run
main();
