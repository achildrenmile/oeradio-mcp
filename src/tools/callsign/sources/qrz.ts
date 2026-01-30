/**
 * QRZ.com API Source
 *
 * Lookups using the QRZ.com XML API
 * Docs: https://www.qrz.com/docs/xml/current.html
 *
 * Note: QRZ.com requires a subscription for API access
 */

import https from 'https';
import { CallsignEntry, LookupResult } from '../types.js';

// Session management
let sessionKey: string | null = null;
let sessionExpiry: number = 0;

// Rate limiting
let lastRequestTime: number = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

/**
 * Parse XML response to extract value
 */
function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Make HTTPS request with rate limiting
 */
async function makeRequest(url: string): Promise<string> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`QRZ HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('QRZ request timeout'));
    });
  });
}

/**
 * Get or refresh QRZ session
 */
async function getSession(username: string, password: string): Promise<string | null> {
  // Check if session is still valid
  if (sessionKey && Date.now() < sessionExpiry) {
    return sessionKey;
  }

  try {
    const url = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&agent=oeradio-mcp-1.0`;
    const response = await makeRequest(url);

    // Check for error
    const error = extractXmlValue(response, 'Error');
    if (error) {
      console.error('[QRZ] Login failed:', error);
      return null;
    }

    const key = extractXmlValue(response, 'Key');
    if (key) {
      sessionKey = key;
      // QRZ sessions last 24 hours, but refresh every 23 hours
      sessionExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return sessionKey;
    }

    return null;
  } catch (error) {
    console.error('[QRZ] Session error:', error);
    return null;
  }
}

/**
 * Look up a callsign in QRZ.com
 */
export async function lookupQRZ(
  callsign: string,
  credentials: { username: string; password: string }
): Promise<LookupResult> {
  try {
    const session = await getSession(credentials.username, credentials.password);

    if (!session) {
      return {
        exists: false,
        source: 'not_found',
        warning: 'QRZ.com authentication failed - check credentials',
      };
    }

    const url = `https://xmldata.qrz.com/xml/current/?s=${session}&callsign=${encodeURIComponent(callsign)}`;
    const response = await makeRequest(url);

    // Check for errors
    const error = extractXmlValue(response, 'Error');
    if (error) {
      if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('no record')) {
        return { exists: false, source: 'not_found' };
      }
      // Session expired - clear and retry
      if (error.toLowerCase().includes('session') || error.toLowerCase().includes('invalid')) {
        sessionKey = null;
        sessionExpiry = 0;
        return {
          exists: false,
          source: 'not_found',
          warning: `QRZ session expired: ${error}`,
        };
      }
      return {
        exists: false,
        source: 'not_found',
        warning: `QRZ error: ${error}`,
      };
    }

    // Parse response
    const foundCallsign = extractXmlValue(response, 'call');
    if (!foundCallsign) {
      return { exists: false, source: 'not_found' };
    }

    // Extract data from QRZ response
    const fname = extractXmlValue(response, 'fname') || '';
    const name = extractXmlValue(response, 'name') || '';
    const fullName = [fname, name].filter(Boolean).join(' ');

    const addr2 = extractXmlValue(response, 'addr2') || ''; // City
    const state = extractXmlValue(response, 'state') || '';
    const zip = extractXmlValue(response, 'zip') || '';
    const country = extractXmlValue(response, 'country') || '';

    const addr1 = extractXmlValue(response, 'addr1') || ''; // Street address

    // Parse callsign structure (for OE callsigns)
    const callsignMatch = foundCallsign.match(/^(OE)(\d)([A-Z]{1,4})$/i);

    // Determine license class from QRZ class field
    const qrzClass = extractXmlValue(response, 'class') || '';
    let licenseClass = 1;
    if (qrzClass.toLowerCase().includes('novice') || qrzClass.toLowerCase().includes('einsteiger')) {
      licenseClass = 4;
    } else if (qrzClass.toLowerCase().includes('3') || qrzClass.toLowerCase().includes('eingeschr')) {
      licenseClass = 3;
    }

    const entry: CallsignEntry = {
      callsign: foundCallsign.toUpperCase(),
      prefix: callsignMatch ? 'OE' : foundCallsign.substring(0, 2),
      district: callsignMatch ? parseInt(callsignMatch[2], 10) : 0,
      suffix: callsignMatch ? callsignMatch[3].toUpperCase() : '',
      name: fullName,
      qth: [zip, addr2, state].filter(Boolean).join(' '),
      plz: zip,
      address: addr1,
      licenseClass: licenseClass,
      isClub: foundCallsign.match(/OE\d+X/i) !== null,
      isHidden: false,
      source: 'qrz',
      lastUpdated: new Date().toISOString(),
    };

    return {
      exists: true,
      data: entry,
      source: 'qrz',
    };
  } catch (error) {
    console.error('[QRZ] Lookup error:', error);
    return {
      exists: false,
      source: 'not_found',
      warning: `QRZ lookup failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Check if QRZ credentials are configured
 */
export function isQRZConfigured(credentials?: { username?: string; password?: string }): boolean {
  return !!(credentials?.username && credentials?.password);
}

/**
 * Invalidate the current session (e.g., on credential change)
 */
export function invalidateSession(): void {
  sessionKey = null;
  sessionExpiry = 0;
}
