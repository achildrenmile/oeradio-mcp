/**
 * HamQTH API Source
 *
 * Lookups using the HamQTH.com XML API
 * Docs: https://www.hamqth.com/developers.php
 */

import https from 'https';
import { CallsignEntry, LookupResult } from '../types.js';

// Session management
let sessionId: string | null = null;
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
        reject(new Error(`HamQTH HTTP ${response.statusCode}`));
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
      reject(new Error('HamQTH request timeout'));
    });
  });
}

/**
 * Get or refresh HamQTH session
 * Note: HamQTH allows anonymous lookups with limited data
 */
async function getSession(username?: string, password?: string): Promise<string | null> {
  // Use anonymous session if no credentials
  if (!username || !password) {
    return 'anonymous';
  }

  // Check if session is still valid (sessions last 1 hour)
  if (sessionId && Date.now() < sessionExpiry) {
    return sessionId;
  }

  try {
    const url = `https://www.hamqth.com/xml.php?u=${encodeURIComponent(username)}&p=${encodeURIComponent(password)}`;
    const response = await makeRequest(url);

    const newSessionId = extractXmlValue(response, 'session_id');
    if (newSessionId) {
      sessionId = newSessionId;
      sessionExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes
      return sessionId;
    }

    const error = extractXmlValue(response, 'error');
    console.error('[HamQTH] Login failed:', error);
    return null;
  } catch (error) {
    console.error('[HamQTH] Session error:', error);
    return null;
  }
}

/**
 * Look up a callsign in HamQTH
 */
export async function lookupHamQTH(
  callsign: string,
  credentials?: { username?: string; password?: string }
): Promise<LookupResult> {
  try {
    const session = await getSession(credentials?.username, credentials?.password);

    // Build URL - anonymous lookup has limited data
    let url: string;
    if (session === 'anonymous') {
      url = `https://www.hamqth.com/xml.php?callsign=${encodeURIComponent(callsign)}&prg=oeradio-mcp`;
    } else if (session) {
      url = `https://www.hamqth.com/xml.php?id=${session}&callsign=${encodeURIComponent(callsign)}&prg=oeradio-mcp`;
    } else {
      return {
        exists: false,
        source: 'not_found',
        warning: 'HamQTH authentication failed',
      };
    }

    const response = await makeRequest(url);

    // Check for errors
    const error = extractXmlValue(response, 'error');
    if (error) {
      if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('callsign')) {
        return { exists: false, source: 'not_found' };
      }
      return {
        exists: false,
        source: 'not_found',
        warning: `HamQTH error: ${error}`,
      };
    }

    // Parse response
    const foundCallsign = extractXmlValue(response, 'callsign');
    if (!foundCallsign) {
      return { exists: false, source: 'not_found' };
    }

    // Extract data
    const name = extractXmlValue(response, 'nick') ||
                 extractXmlValue(response, 'adr_name') ||
                 '';
    const qth = extractXmlValue(response, 'qth') ||
                extractXmlValue(response, 'adr_city') ||
                '';
    const country = extractXmlValue(response, 'country') || '';

    // Parse callsign structure (for OE callsigns)
    const callsignMatch = foundCallsign.match(/^(OE)(\d)([A-Z]{1,4})$/i);

    const entry: CallsignEntry = {
      callsign: foundCallsign.toUpperCase(),
      prefix: callsignMatch ? 'OE' : foundCallsign.substring(0, 2),
      district: callsignMatch ? parseInt(callsignMatch[2], 10) : 0,
      suffix: callsignMatch ? callsignMatch[3].toUpperCase() : '',
      name: name,
      qth: qth,
      plz: '',
      address: '',
      licenseClass: 1, // Unknown from HamQTH
      isClub: foundCallsign.includes('X') || false,
      isHidden: false,
      source: 'hamqth',
      lastUpdated: new Date().toISOString(),
    };

    return {
      exists: true,
      data: entry,
      source: 'hamqth',
    };
  } catch (error) {
    console.error('[HamQTH] Lookup error:', error);
    return {
      exists: false,
      source: 'not_found',
      warning: `HamQTH lookup failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Check if HamQTH is available (basic connectivity test)
 */
export async function isHamQTHAvailable(): Promise<boolean> {
  try {
    // Use a well-known callsign for testing
    const url = 'https://www.hamqth.com/xml.php?callsign=DL1AAA&prg=oeradio-mcp';
    await makeRequest(url);
    return true;
  } catch {
    return false;
  }
}
