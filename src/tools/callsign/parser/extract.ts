/**
 * PDF Extraction for Austrian Callsign List
 *
 * Extracts callsign data from the fb.gv.at PDF
 */

import { PDFParse } from 'pdf-parse';
import { RawCallsignRow } from './types.js';

/**
 * Extract callsign rows from PDF buffer using pdf-parse
 */
export async function extractFromPdf(buffer: Buffer): Promise<RawCallsignRow[]> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = result.text;

  const rows: RawCallsignRow[] = [];
  const lines = text.split('\n');

  // Pattern for callsign lines
  // Format: OE1ABC    Name Name    1234 City    Address    1
  const callsignPattern = /^(OE[0-9][A-Z]{1,4})\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, headers, and footers
    if (!trimmed) continue;
    if (trimmed.startsWith('Rufzeichen')) continue;
    if (trimmed.startsWith('Gemäß')) continue;
    if (trimmed.startsWith('Fernmeldebüro')) continue;
    if (trimmed.startsWith('DVR:')) continue;
    if (trimmed.includes('Seite ') && trimmed.includes(' von ')) continue;
    if (trimmed.includes('Stand 20')) continue;

    // Check if line starts with a callsign
    const match = trimmed.match(callsignPattern);
    if (!match) continue;

    const callsign = match[1];
    const rest = match[2];

    // Parse the rest of the line
    const parsed = parseCallsignLine(callsign, rest);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
}

/**
 * Parse a single callsign line
 */
function parseCallsignLine(callsign: string, rest: string): RawCallsignRow | null {
  // Check for hidden entries (*-*-*)
  if (rest.includes('*-*-*')) {
    return {
      callsign,
      name: '*-*-*',
      location: '*-*-*',
      address: '*-*-*',
      licenseClass: rest.trim().slice(-1) || '1',
    };
  }

  // Try to parse the line structure
  // The format is: Name    PLZ City    Address    Class
  // But columns are separated by multiple spaces

  // Split by multiple spaces (2 or more)
  const parts = rest.split(/\s{2,}/);

  if (parts.length >= 4) {
    // Last part should be the license class (single digit)
    const lastPart = parts[parts.length - 1].trim();
    const licenseClass = lastPart.match(/^[1-4]$/) ? lastPart : '1';

    // Second to last is address (if license class was separate)
    // Otherwise last part contains both
    let address: string;
    let addressIndex: number;

    if (lastPart.match(/^[1-4]$/)) {
      address = parts[parts.length - 2]?.trim() || '';
      addressIndex = parts.length - 2;
    } else {
      // License class is at end of address
      address = lastPart.replace(/\s+[1-4]$/, '');
      addressIndex = parts.length - 1;
    }

    const name = parts[0]?.trim() || '';
    const location = parts[1]?.trim() || '';

    // If we have more parts between name and address, they might be part of location
    if (addressIndex > 2) {
      // Combine middle parts as location
      const locationParts = parts.slice(1, addressIndex);
      return {
        callsign,
        name,
        location: locationParts.join(' ').trim(),
        address,
        licenseClass,
      };
    }

    return {
      callsign,
      name,
      location,
      address,
      licenseClass,
    };
  }

  // Fallback: try regex-based parsing
  return parseWithRegex(callsign, rest);
}

/**
 * Fallback regex-based parsing
 */
function parseWithRegex(callsign: string, rest: string): RawCallsignRow | null {
  // Try to extract PLZ (4 digits) to split location
  const plzMatch = rest.match(/^(.+?)\s+(\d{4})\s+(\S+(?:\s+\S+)*)\s+(.+?)\s+([1-4])$/);

  if (plzMatch) {
    return {
      callsign,
      name: plzMatch[1].trim(),
      location: `${plzMatch[2]} ${plzMatch[3]}`.trim(),
      address: plzMatch[4].trim(),
      licenseClass: plzMatch[5],
    };
  }

  // Simpler pattern: just get name and license class
  const simpleMatch = rest.match(/^(.+?)\s+([1-4])$/);
  if (simpleMatch) {
    return {
      callsign,
      name: simpleMatch[1].trim(),
      location: '',
      address: '',
      licenseClass: simpleMatch[2],
    };
  }

  // Last resort: just store everything as name
  const classMatch = rest.match(/\s+([1-4])$/);
  return {
    callsign,
    name: rest.replace(/\s+[1-4]$/, '').trim(),
    location: '',
    address: '',
    licenseClass: classMatch ? classMatch[1] : '1',
  };
}

/**
 * Extract using pdftotext command (alternative method)
 */
export async function extractWithPdftotext(pdfPath: string): Promise<RawCallsignRow[]> {
  const { execSync } = await import('child_process');
  const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });

  const rows: RawCallsignRow[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match callsign at start of line
    const match = trimmed.match(/^(OE[0-9][A-Z]{1,4})\s+(.+)$/);
    if (!match) continue;

    // Skip header/footer lines
    if (match[2].includes('Name') && match[2].includes('Standort')) continue;

    const callsign = match[1];
    const rest = match[2];

    const parsed = parseCallsignLine(callsign, rest);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
}
