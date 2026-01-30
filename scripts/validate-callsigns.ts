#!/usr/bin/env npx ts-node

/**
 * Validate Callsign Database
 *
 * Validates the existing callsign database file.
 *
 * Usage: npm run validate-callsigns
 */

import { promises as fs } from 'fs';
import path from 'path';
import { validateDatabase, generateReport } from '../src/tools/callsign/parser/validate.js';
import { CallsignDatabase } from '../src/tools/callsign/parser/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'callsigns_oe.json');

async function main() {
  console.log('=== Callsign Database Validation ===\n');

  try {
    // Load database
    const content = await fs.readFile(DB_FILE, 'utf-8');
    const database: CallsignDatabase = JSON.parse(content);

    console.log(`Database version: ${database.version}`);
    console.log(`Parsed at: ${database.parsedAt}`);
    console.log(`Entry count: ${database.count}`);
    console.log('');

    // Validate
    const validation = validateDatabase(database);

    // Print report
    console.log(generateReport(validation));

    // Exit with error code if validation failed
    if (validation.errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('[ERROR] Database file not found:', DB_FILE);
      console.error('Run "npm run update-callsigns" first to create the database.');
    } else {
      console.error('[ERROR] Validation failed:', error);
    }
    process.exit(1);
  }
}

main();
