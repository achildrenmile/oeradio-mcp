/**
 * Callsign MCP Tools
 *
 * Tool definitions for Austrian amateur radio callsign operations
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { lookupCallsign, setConfig, getConfig } from './lookup.js';
import { checkAvailability } from './availability.js';
import { generateSuggestions } from './suggest.js';
import { validateCallsign, getDistrictName, getLicenseClassName } from './validate.js';
import { getDatabaseInfo, getDatabaseStats } from './sources/local.js';
import { DISTRICTS, LICENSE_CLASSES } from './types.js';

/**
 * Register all callsign tools with the MCP server
 */
export function registerCallsignTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // TOOL: Callsign Lookup
  // --------------------------------------------------------------------------
  server.tool(
    'callsign_lookup',
    'Sucht ein österreichisches Amateurfunkrufzeichen und gibt Inhaberinformationen zurück. Primäre Quelle: offizielle fb.gv.at Liste, mit Fallback auf QRZ.com und HamQTH.',
    {
      callsign: z.string().describe('Das zu suchende Rufzeichen (z.B. "OE8YML")'),
      include_address: z.boolean().default(false).describe('Adresse inkludieren wenn verfügbar'),
    },
    async ({ callsign, include_address }) => {
      try {
        const result = await lookupCallsign(callsign);

        if (!result.exists) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                exists: false,
                callsign: callsign.toUpperCase(),
                source: result.source,
                warning: result.warning,
                message: 'Rufzeichen nicht gefunden',
              }, null, 2),
            }],
          };
        }

        // Build response data
        const data = result.data!;
        const response: Record<string, unknown> = {
          exists: true,
          callsign: data.callsign,
          name: data.isHidden ? '[versteckt]' : data.name,
          qth: data.isHidden ? '[versteckt]' : data.qth,
          district: data.district,
          districtName: getDistrictName(data.district),
          licenseClass: data.licenseClass,
          licenseClassName: getLicenseClassName(data.licenseClass),
          isClub: data.isClub,
          source: result.source,
          lastUpdated: data.lastUpdated,
        };

        // Include address only if requested and not hidden
        if (include_address && !data.isHidden && data.address) {
          response.address = data.address;
        }

        if (result.warning) {
          response.warning = result.warning;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Lookup fehlgeschlagen: ${(error as Error).message}`,
            }, null, 2),
          }],
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Callsign Availability Check
  // --------------------------------------------------------------------------
  server.tool(
    'callsign_available',
    'Prüft ob ein Suffix in Österreich verfügbar ist. Zeigt in welchen Bundesländern das Rufzeichen frei oder belegt ist.',
    {
      suffix: z.string().describe('2-3 Buchstaben Suffix (z.B. "YML")'),
      district: z.number().min(1).max(9).optional().describe('Spezifisches Bundesland prüfen (1-9)'),
    },
    async ({ suffix, district }) => {
      try {
        const result = await checkAvailability(suffix, district);

        const response: Record<string, unknown> = {
          suffix: result.suffix,
          available: result.available,
          available_districts: result.available_districts.map(d => ({
            district: d,
            name: getDistrictName(d),
            callsign: `OE${d}${result.suffix}`,
          })),
          taken_districts: result.taken_districts.map(d => ({
            district: d,
            name: getDistrictName(d),
          })),
        };

        if (result.taken_by && result.taken_by.length > 0) {
          response.taken_by = result.taken_by.map(t => ({
            callsign: t.callsign,
            name: t.name,
            district: t.district,
            districtName: getDistrictName(t.district),
          }));
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Verfügbarkeitsprüfung fehlgeschlagen: ${(error as Error).message}`,
            }, null, 2),
          }],
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Callsign Suggestions
  // --------------------------------------------------------------------------
  server.tool(
    'callsign_suggest',
    'Generiert Wunschrufzeichen-Vorschläge basierend auf Namen und Präferenzen. Berücksichtigt Verfügbarkeit, Phonetik und CW-Freundlichkeit.',
    {
      name: z.string().describe('Vor- und/oder Nachname'),
      preferred_district: z.number().min(1).max(9).optional().describe('Bevorzugtes Bundesland (1-9)'),
      max_results: z.number().min(1).max(50).default(10).describe('Maximale Anzahl Vorschläge'),
      exclude_club: z.boolean().default(true).describe('Keine X-Präfixe (Klubrufzeichen) vorschlagen'),
      min_phonetic_score: z.number().min(0).max(1).default(0.5).describe('Mindest-Phonetik-Score (0-1)'),
    },
    async ({ name, preferred_district, max_results, exclude_club, min_phonetic_score }) => {
      try {
        const suggestions = await generateSuggestions({
          name,
          preferred_district,
          max_results,
          exclude_club,
          min_phonetic_score,
        });

        if (suggestions.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                name,
                suggestions: [],
                message: 'Keine passenden verfügbaren Rufzeichen gefunden. Versuche einen anderen Namen oder senke den min_phonetic_score.',
              }, null, 2),
            }],
          };
        }

        const response = {
          name,
          preferred_district: preferred_district ? {
            district: preferred_district,
            name: getDistrictName(preferred_district),
          } : null,
          suggestions: suggestions.map(s => ({
            suffix: s.suffix,
            example_callsigns: s.available_districts.slice(0, 3).map(d => `OE${d}${s.suffix}`),
            available_districts: s.available_districts.map(d => ({
              district: d,
              name: getDistrictName(d),
            })),
            phonetic_score: s.phonetic_score,
            cw_score: s.cw_score,
            derivation: s.derivation,
          })),
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Vorschlagsgenerierung fehlgeschlagen: ${(error as Error).message}`,
            }, null, 2),
          }],
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Callsign Validation
  // --------------------------------------------------------------------------
  server.tool(
    'callsign_validate',
    'Validiert ein Rufzeichen gegen österreichische Regeln. Prüft Format, Bezirk und Suffix-Länge.',
    {
      callsign: z.string().describe('Zu validierendes Rufzeichen'),
    },
    async ({ callsign }) => {
      const result = validateCallsign(callsign);

      const response: Record<string, unknown> = {
        callsign: callsign.toUpperCase(),
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      };

      if (result.parsed) {
        response.parsed = {
          prefix: result.parsed.prefix,
          district: result.parsed.district,
          districtName: getDistrictName(result.parsed.district),
          suffix: result.parsed.suffix,
          isClub: result.parsed.suffix.startsWith('X'),
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Callsign Database Info
  // --------------------------------------------------------------------------
  server.tool(
    'callsign_database_info',
    'Zeigt Informationen über die Rufzeichen-Datenbank (Version, Anzahl Einträge, Statistiken)',
    {},
    async () => {
      try {
        const [info, stats] = await Promise.all([
          getDatabaseInfo(),
          getDatabaseStats(),
        ]);

        const response = {
          version: info.version,
          sourceUrl: info.sourceUrl,
          parsedAt: info.parsedAt,
          totalEntries: info.count,
          statistics: {
            byDistrict: Object.entries(stats.byDistrict).map(([d, count]) => ({
              district: parseInt(d),
              name: getDistrictName(parseInt(d)),
              count,
            })),
            byLicenseClass: Object.entries(stats.byLicenseClass).map(([c, count]) => ({
              class: parseInt(c),
              name: getLicenseClassName(parseInt(c)),
              count,
            })),
            clubStations: stats.clubStations,
            hiddenEntries: stats.hiddenEntries,
          },
          legalNotice: 'Daten aus der öffentlichen Rufzeichenliste des österreichischen Fernmeldebüros (fb.gv.at). Verwendung nur für Amateurfunkzwecke gemäß §150 TKG 2021.',
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Datenbank-Info konnte nicht geladen werden: ${(error as Error).message}`,
              hint: 'Führe "npm run update-callsigns" aus um die Datenbank zu erstellen.',
            }, null, 2),
          }],
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // RESOURCE: District Reference
  // --------------------------------------------------------------------------
  server.resource(
    'callsigns://districts',
    'Österreichische Amateurfunk-Bezirke (OE1-OE9)',
    async () => ({
      contents: [{
        uri: 'callsigns://districts',
        mimeType: 'application/json',
        text: JSON.stringify({
          description: 'Österreichische Amateurfunk-Bezirke',
          districts: Object.entries(DISTRICTS).map(([num, name]) => ({
            number: parseInt(num),
            prefix: `OE${num}`,
            name,
          })),
        }, null, 2),
      }],
    })
  );

  // --------------------------------------------------------------------------
  // RESOURCE: License Classes
  // --------------------------------------------------------------------------
  server.resource(
    'callsigns://license-classes',
    'Österreichische Amateurfunk-Lizenzklassen',
    async () => ({
      contents: [{
        uri: 'callsigns://license-classes',
        mimeType: 'application/json',
        text: JSON.stringify({
          description: 'Österreichische Amateurfunk-Lizenzklassen',
          classes: Object.entries(LICENSE_CLASSES).map(([num, name]) => ({
            class: parseInt(num),
            name,
          })),
        }, null, 2),
      }],
    })
  );
}

// Re-export for external use
export { setConfig, getConfig } from './lookup.js';
export { DISTRICTS, LICENSE_CLASSES } from './types.js';
