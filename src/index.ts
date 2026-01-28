/**
 * oeradio.at MCP Server (Docker Edition)
 * 
 * Öffentlicher MCP-Server für Amateurfunk-Berechnungen und Informationen
 * IARU Region 1 Bandpläne, EIRP-Berechnung, Kabeldämpfung, Akkuplanung
 * 
 * Erstellt von OE8YML - https://oeradio.at
 */

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// DATEN: IARU Region 1 Bandpläne (Kurzwelle + VHF/UHF)
// ============================================================================

const BAND_PLANS: Record<string, {
  start: number;
  end: number;
  unit: "kHz" | "MHz";
  modes: string;
  maxPower: string;
  notes?: string;
}> = {
  "2200m": { start: 135.7, end: 137.8, unit: "kHz", modes: "CW, QRSS, Digi (schmalbandig)", maxPower: "1W EIRP", notes: "Sekundärstatus" },
  "630m": { start: 472, end: 479, unit: "kHz", modes: "CW, QRSS, Digi (schmalbandig)", maxPower: "1W EIRP", notes: "Sekundärstatus" },
  "160m": { start: 1810, end: 2000, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "80m": { start: 3500, end: 3800, unit: "kHz", modes: "CW, SSB, Digi, AM", maxPower: "1000W" },
  "60m": { start: 5351.5, end: 5366.5, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "15W EIRP", notes: "Sekundärstatus, kanalbasiert" },
  "40m": { start: 7000, end: 7200, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "30m": { start: 10100, end: 10150, unit: "kHz", modes: "CW, Digi (schmalbandig)", maxPower: "1000W", notes: "Kein SSB erlaubt" },
  "20m": { start: 14000, end: 14350, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "17m": { start: 18068, end: 18168, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "15m": { start: 21000, end: 21450, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "12m": { start: 24890, end: 24990, unit: "kHz", modes: "CW, SSB, Digi", maxPower: "1000W" },
  "10m": { start: 28000, end: 29700, unit: "kHz", modes: "CW, SSB, FM, Digi, Sat", maxPower: "1000W" },
  "6m": { start: 50, end: 52, unit: "MHz", modes: "CW, SSB, FM, Digi", maxPower: "1000W", notes: "Sekundärstatus in manchen Ländern" },
  "2m": { start: 144, end: 146, unit: "MHz", modes: "CW, SSB, FM, Digi, ATV, Sat", maxPower: "1000W" },
  "70cm": { start: 430, end: 440, unit: "MHz", modes: "CW, SSB, FM, Digi, ATV, Sat", maxPower: "1000W" },
  "23cm": { start: 1240, end: 1300, unit: "MHz", modes: "Alle Modes", maxPower: "1000W" },
  "13cm": { start: 2320, end: 2450, unit: "MHz", modes: "Alle Modes", maxPower: "1000W" }
};

// ============================================================================
// DATEN: Kabeltypen mit Dämpfung (dB/100m bei verschiedenen Frequenzen in MHz)
// ============================================================================

const CABLE_DATA: Record<string, Record<string, number>> = {
  "RG58": { "3.5": 5.2, "7": 7.5, "14": 10.8, "21": 13.5, "28": 15.5, "50": 21, "144": 36, "432": 66 },
  "RG213": { "3.5": 2.6, "7": 3.8, "14": 5.3, "21": 6.5, "28": 7.6, "50": 10, "144": 17.5, "432": 32 },
  "H2000Flex": { "3.5": 2.2, "7": 3.2, "14": 4.5, "21": 5.5, "28": 6.4, "50": 8.5, "144": 15, "432": 27 },
  "Aircell7": { "3.5": 1.9, "7": 2.8, "14": 3.9, "21": 4.8, "28": 5.6, "50": 7.5, "144": 13, "432": 23 },
  "Ecoflex10": { "3.5": 1.2, "7": 1.8, "14": 2.5, "21": 3.1, "28": 3.6, "50": 4.8, "144": 8.5, "432": 15 },
  "Ecoflex15": { "3.5": 0.8, "7": 1.2, "14": 1.7, "21": 2.1, "28": 2.5, "50": 3.3, "144": 5.8, "432": 10.5 },
  "LMR400": { "3.5": 1.1, "7": 1.6, "14": 2.3, "21": 2.8, "28": 3.2, "50": 4.3, "144": 7.5, "432": 13.5 },
  "LMR600": { "3.5": 0.7, "7": 1.0, "14": 1.4, "21": 1.8, "28": 2.1, "50": 2.8, "144": 4.9, "432": 8.8 }
};

// ============================================================================
// DATEN: Typische Antennengewinne
// ============================================================================

const ANTENNA_GAINS: Record<string, { gain_dbi: number; description: string }> = {
  "dipol": { gain_dbi: 2.15, description: "Halbwellendipol" },
  "groundplane": { gain_dbi: 2.0, description: "1/4λ Groundplane" },
  "yagi-3el": { gain_dbi: 7.0, description: "3-Element Yagi" },
  "yagi-5el": { gain_dbi: 10.0, description: "5-Element Yagi" },
  "yagi-7el": { gain_dbi: 12.0, description: "7-Element Yagi" },
  "quad-2el": { gain_dbi: 8.0, description: "2-Element Quad" },
  "vertical": { gain_dbi: 0, description: "Vertikalantenne (λ/4)" },
  "j-pole": { gain_dbi: 2.0, description: "J-Pole Antenne" },
  "slim-jim": { gain_dbi: 3.0, description: "Slim Jim" },
  "collinear-x50": { gain_dbi: 4.5, description: "X50 Typ Collinear" },
  "collinear-x200": { gain_dbi: 6.0, description: "X200 Typ Collinear" },
  "collinear-x510": { gain_dbi: 8.3, description: "X510 Typ Collinear" }
};

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function interpolateCableLoss(cableData: Record<string, number>, frequencyMhz: number): number {
  const freqs = Object.keys(cableData).map(Number).sort((a, b) => a - b);
  
  if (frequencyMhz <= freqs[0]) {
    return cableData[freqs[0].toString()];
  }
  if (frequencyMhz >= freqs[freqs.length - 1]) {
    return cableData[freqs[freqs.length - 1].toString()];
  }
  
  const lower = freqs.filter(f => f <= frequencyMhz).pop()!;
  const upper = freqs.find(f => f > frequencyMhz)!;
  const ratio = (frequencyMhz - lower) / (upper - lower);
  
  return cableData[lower.toString()] + ratio * (cableData[upper.toString()] - cableData[lower.toString()]);
}

// ============================================================================
// MCP SERVER ERSTELLEN
// ============================================================================

function createOeradioMcpServer(): McpServer {
  const server = new McpServer({
    name: "oeradio-mcp",
    version: "1.0.0"
  });

  // --------------------------------------------------------------------------
  // TOOL: Bandplan abfragen
  // --------------------------------------------------------------------------
  server.tool(
    "get_band_plan",
    "Gibt Frequenzgrenzen, erlaubte Modes und maximale Sendeleistung für ein Amateurfunkband zurück (IARU Region 1 / Österreich)",
    {
      band: z.string().describe("Bandbezeichnung wie '20m', '2m', '70cm', '160m'")
    },
    async ({ band }) => {
      const normalizedBand = band.toLowerCase().replace(/\s/g, "");
      const info = BAND_PLANS[normalizedBand];
      
      if (!info) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Band "${band}" nicht gefunden`,
              availableBands: Object.keys(BAND_PLANS)
            }, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            band: normalizedBand,
            frequencyRange: `${info.start} - ${info.end} ${info.unit}`,
            start: info.start,
            end: info.end,
            unit: info.unit,
            modes: info.modes,
            maxPower: info.maxPower,
            notes: info.notes || null
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Alle Bandpläne auflisten
  // --------------------------------------------------------------------------
  server.tool(
    "list_all_bands",
    "Listet alle verfügbaren Amateurfunkbänder mit Grundinformationen auf",
    {},
    async () => {
      const bands = Object.entries(BAND_PLANS).map(([band, info]) => ({
        band,
        range: `${info.start}-${info.end} ${info.unit}`,
        modes: info.modes
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ bands, total: bands.length }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Frequenz prüfen
  // --------------------------------------------------------------------------
  server.tool(
    "check_frequency",
    "Prüft ob eine Frequenz im Amateurfunk erlaubt ist und gibt das zugehörige Band zurück",
    {
      frequency: z.number().positive().describe("Frequenz als Zahl"),
      unit: z.enum(["Hz", "kHz", "MHz"]).default("kHz").describe("Einheit der Frequenz")
    },
    async ({ frequency, unit }) => {
      let freqKhz: number;
      let freqMhz: number;
      
      switch (unit) {
        case "Hz":
          freqKhz = frequency / 1000;
          freqMhz = frequency / 1000000;
          break;
        case "kHz":
          freqKhz = frequency;
          freqMhz = frequency / 1000;
          break;
        case "MHz":
          freqKhz = frequency * 1000;
          freqMhz = frequency;
          break;
      }
      
      for (const [band, info] of Object.entries(BAND_PLANS)) {
        const checkFreq = info.unit === "kHz" ? freqKhz : freqMhz;
        if (checkFreq >= info.start && checkFreq <= info.end) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                frequency: `${frequency} ${unit}`,
                allowed: true,
                band,
                modes: info.modes,
                maxPower: info.maxPower,
                bandLimits: `${info.start} - ${info.end} ${info.unit}`,
                notes: info.notes || null
              }, null, 2)
            }]
          };
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            frequency: `${frequency} ${unit}`,
            allowed: false,
            message: "Frequenz liegt außerhalb der Amateurfunkbänder (IARU Region 1)"
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: EIRP berechnen (StrahlBlick)
  // --------------------------------------------------------------------------
  server.tool(
    "calculate_eirp",
    "Berechnet EIRP (Equivalent Isotropically Radiated Power) aus Sendeleistung, Kabelverlust und Antennengewinn. Nützlich für Sicherheitsabstands-Berechnungen nach ÖNORM.",
    {
      power_watts: z.number().min(0.001).max(2000).describe("Sendeleistung in Watt"),
      cable_loss_db: z.number().min(0).max(50).describe("Kabelverlust in dB"),
      antenna_gain_dbi: z.number().min(-10).max(50).describe("Antennengewinn in dBi")
    },
    async ({ power_watts, cable_loss_db, antenna_gain_dbi }) => {
      const power_dbw = 10 * Math.log10(power_watts);
      const eirp_dbw = power_dbw - cable_loss_db + antenna_gain_dbi;
      const eirp_watts = Math.pow(10, eirp_dbw / 10);
      
      const erp_dbw = eirp_dbw - 2.15;
      const erp_watts = Math.pow(10, erp_dbw / 10);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: {
              power_watts,
              power_dbw: Math.round(power_dbw * 100) / 100,
              cable_loss_db,
              antenna_gain_dbi
            },
            result: {
              eirp_watts: Math.round(eirp_watts * 100) / 100,
              eirp_dbw: Math.round(eirp_dbw * 100) / 100,
              eirp_dbm: Math.round((eirp_dbw + 30) * 100) / 100,
              erp_watts: Math.round(erp_watts * 100) / 100,
              erp_dbw: Math.round(erp_dbw * 100) / 100
            },
            explanation: {
              eirp: "Equivalent Isotropically Radiated Power (bezogen auf isotropen Strahler)",
              erp: "Effective Radiated Power (bezogen auf Halbwellendipol, EIRP - 2.15dB)"
            }
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Kabeldämpfung berechnen (KabelBlick)
  // --------------------------------------------------------------------------
  server.tool(
    "calculate_cable_loss",
    "Berechnet die Kabeldämpfung für verschiedene Koaxialkabeltypen bei einer bestimmten Frequenz und Länge",
    {
      cable_type: z.enum(["RG58", "RG213", "H2000Flex", "Aircell7", "Ecoflex10", "Ecoflex15", "LMR400", "LMR600"])
        .describe("Kabeltyp"),
      length_meters: z.number().min(0.1).max(1000).describe("Kabellänge in Metern"),
      frequency_mhz: z.number().min(0.1).max(3000).describe("Frequenz in MHz")
    },
    async ({ cable_type, length_meters, frequency_mhz }) => {
      const cableData = CABLE_DATA[cable_type];
      const loss_per_100m = interpolateCableLoss(cableData, frequency_mhz);
      const total_loss = (loss_per_100m * length_meters) / 100;
      
      const power_loss_percent = (1 - Math.pow(10, -total_loss / 10)) * 100;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: { cable_type, length_meters, frequency_mhz },
            result: {
              total_loss_db: Math.round(total_loss * 100) / 100,
              loss_per_100m_db: Math.round(loss_per_100m * 100) / 100,
              power_loss_percent: Math.round(power_loss_percent * 10) / 10,
              power_remaining_percent: Math.round((100 - power_loss_percent) * 10) / 10
            },
            tip: total_loss > 3 
              ? "Hoher Verlust! Erwäge kürzeres oder besseres Kabel." 
              : "Akzeptabler Verlust."
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Alle Kabeltypen vergleichen
  // --------------------------------------------------------------------------
  server.tool(
    "compare_cables",
    "Vergleicht alle verfügbaren Kabeltypen bei einer bestimmten Frequenz und Länge",
    {
      length_meters: z.number().min(0.1).max(1000).describe("Kabellänge in Metern"),
      frequency_mhz: z.number().min(0.1).max(3000).describe("Frequenz in MHz")
    },
    async ({ length_meters, frequency_mhz }) => {
      const comparison = Object.entries(CABLE_DATA).map(([type, data]) => {
        const loss_per_100m = interpolateCableLoss(data, frequency_mhz);
        const total_loss = (loss_per_100m * length_meters) / 100;
        return {
          cable: type,
          loss_db: Math.round(total_loss * 100) / 100,
          loss_per_100m: Math.round(loss_per_100m * 100) / 100
        };
      }).sort((a, b) => a.loss_db - b.loss_db);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            parameters: { length_meters, frequency_mhz },
            comparison,
            recommendation: comparison[0].cable
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Akkukapazität berechnen (AkkuBlick)
  // --------------------------------------------------------------------------
  server.tool(
    "calculate_battery_runtime",
    "Berechnet die Akkulaufzeit basierend auf Kapazität und durchschnittlichem Stromverbrauch. Berücksichtigt Effizienz und Entladetiefe.",
    {
      capacity_ah: z.number().min(0.1).max(1000).describe("Akkukapazität in Amperestunden (Ah)"),
      voltage: z.number().min(1).max(60).describe("Nennspannung des Akkus in Volt"),
      consumption_watts: z.number().min(0.1).max(2000).describe("Durchschnittlicher Verbrauch in Watt"),
      efficiency: z.number().min(0.5).max(1.0).default(0.85).describe("Wirkungsgrad des Reglers (0.85 = 85%)"),
      max_discharge_percent: z.number().min(10).max(100).default(80).describe("Maximale Entladetiefe in % (80% empfohlen für LiFePO4)")
    },
    async ({ capacity_ah, voltage, consumption_watts, efficiency, max_discharge_percent }) => {
      const total_wh = capacity_ah * voltage;
      const usable_wh = total_wh * (max_discharge_percent / 100) * efficiency;
      const runtime_hours = usable_wh / consumption_watts;
      
      const hours = Math.floor(runtime_hours);
      const minutes = Math.round((runtime_hours - hours) * 60);
      
      const current_draw_a = consumption_watts / voltage / efficiency;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: {
              capacity_ah,
              voltage,
              consumption_watts,
              efficiency_percent: efficiency * 100,
              max_discharge_percent
            },
            result: {
              total_capacity_wh: Math.round(total_wh),
              usable_capacity_wh: Math.round(usable_wh),
              runtime_hours: Math.round(runtime_hours * 100) / 100,
              runtime_formatted: `${hours}h ${minutes}min`,
              current_draw_a: Math.round(current_draw_a * 100) / 100
            },
            portableOperation: {
              sota_activation: runtime_hours >= 1 ? "✓ Ausreichend für SOTA" : "⚠ Knapp für SOTA",
              pota_activation: runtime_hours >= 2 ? "✓ Ausreichend für POTA" : "⚠ Knapp für POTA",
              fieldday: runtime_hours >= 6 ? "✓ Geeignet für Fieldday" : "⚠ Zusatzakku empfohlen"
            }
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Antennengewinn nachschlagen
  // --------------------------------------------------------------------------
  server.tool(
    "get_antenna_gain",
    "Gibt typische Gewinnwerte für verschiedene Antennentypen zurück",
    {
      antenna_type: z.string().optional().describe("Antennentyp (z.B. 'dipol', 'yagi-5el') oder leer für alle")
    },
    async ({ antenna_type }) => {
      if (antenna_type) {
        const normalized = antenna_type.toLowerCase().replace(/\s/g, "-");
        const antenna = ANTENNA_GAINS[normalized];
        
        if (!antenna) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: `Antenne "${antenna_type}" nicht gefunden`,
                availableTypes: Object.keys(ANTENNA_GAINS)
              }, null, 2)
            }]
          };
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              type: normalized,
              gain_dbi: antenna.gain_dbi,
              gain_dbd: Math.round((antenna.gain_dbi - 2.15) * 100) / 100,
              description: antenna.description
            }, null, 2)
          }]
        };
      }
      
      const antennas = Object.entries(ANTENNA_GAINS).map(([type, data]) => ({
        type,
        gain_dbi: data.gain_dbi,
        gain_dbd: Math.round((data.gain_dbi - 2.15) * 100) / 100,
        description: data.description
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ antennas }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: Wellenlänge berechnen
  // --------------------------------------------------------------------------
  server.tool(
    "calculate_wavelength",
    "Berechnet die Wellenlänge für eine gegebene Frequenz und optional Drahtlängen für Antennen",
    {
      frequency: z.number().positive().describe("Frequenz"),
      unit: z.enum(["Hz", "kHz", "MHz", "GHz"]).default("MHz").describe("Einheit der Frequenz"),
      velocity_factor: z.number().min(0.5).max(1.0).default(0.95).describe("Verkürzungsfaktor für Draht (0.95 typisch)")
    },
    async ({ frequency, unit, velocity_factor }) => {
      const c = 299792458;
      
      let freq_hz: number;
      switch (unit) {
        case "Hz": freq_hz = frequency; break;
        case "kHz": freq_hz = frequency * 1000; break;
        case "MHz": freq_hz = frequency * 1000000; break;
        case "GHz": freq_hz = frequency * 1000000000; break;
      }
      
      const wavelength_m = c / freq_hz;
      const wavelength_wire = wavelength_m * velocity_factor;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: { frequency: `${frequency} ${unit}`, velocity_factor },
            result: {
              wavelength_m: Math.round(wavelength_m * 1000) / 1000,
              wavelength_wire_m: Math.round(wavelength_wire * 1000) / 1000,
              half_wave_m: Math.round((wavelength_wire / 2) * 1000) / 1000,
              quarter_wave_m: Math.round((wavelength_wire / 4) * 1000) / 1000,
              antenna_lengths: {
                dipol_total_m: Math.round((wavelength_wire / 2) * 1000) / 1000,
                dipol_each_arm_m: Math.round((wavelength_wire / 4) * 1000) / 1000,
                quarter_wave_vertical_m: Math.round((wavelength_wire / 4) * 1000) / 1000,
                five_eighths_m: Math.round((wavelength_wire * 0.625) * 1000) / 1000
              }
            }
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: SWR zu Verlust umrechnen
  // --------------------------------------------------------------------------
  server.tool(
    "calculate_swr_loss",
    "Berechnet den Leistungsverlust durch Fehlanpassung (SWR/VSWR)",
    {
      swr: z.number().min(1.0).max(100).describe("SWR-Wert (z.B. 1.5, 2.0, 3.0)")
    },
    async ({ swr }) => {
      const gamma = (swr - 1) / (swr + 1);
      const reflected_power_percent = gamma * gamma * 100;
      const transmitted_power_percent = 100 - reflected_power_percent;
      const mismatch_loss_db = -10 * Math.log10(1 - gamma * gamma);
      const return_loss_db = -20 * Math.log10(gamma);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: { swr },
            result: {
              reflection_coefficient: Math.round(gamma * 1000) / 1000,
              reflected_power_percent: Math.round(reflected_power_percent * 10) / 10,
              transmitted_power_percent: Math.round(transmitted_power_percent * 10) / 10,
              mismatch_loss_db: Math.round(mismatch_loss_db * 100) / 100,
              return_loss_db: Math.round(return_loss_db * 10) / 10
            },
            assessment: swr <= 1.5 ? "Sehr gut" 
              : swr <= 2.0 ? "Gut" 
              : swr <= 3.0 ? "Akzeptabel"
              : "Zu hoch - Tuner empfohlen"
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // TOOL: dBm/dBW/Watt Umrechnung
  // --------------------------------------------------------------------------
  server.tool(
    "convert_power",
    "Rechnet Leistungswerte zwischen Watt, dBm und dBW um",
    {
      value: z.number().describe("Leistungswert"),
      from_unit: z.enum(["W", "mW", "dBm", "dBW"]).describe("Ausgangseinheit")
    },
    async ({ value, from_unit }) => {
      let watts: number;
      
      switch (from_unit) {
        case "W": watts = value; break;
        case "mW": watts = value / 1000; break;
        case "dBm": watts = Math.pow(10, (value - 30) / 10); break;
        case "dBW": watts = Math.pow(10, value / 10); break;
      }
      
      const dbm = 10 * Math.log10(watts * 1000);
      const dbw = 10 * Math.log10(watts);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            input: { value, unit: from_unit },
            result: {
              watts: watts >= 1 ? Math.round(watts * 1000) / 1000 : watts.toExponential(3),
              milliwatts: Math.round(watts * 1000 * 1000) / 1000,
              dBm: Math.round(dbm * 100) / 100,
              dBW: Math.round(dbw * 100) / 100
            }
          }, null, 2)
        }]
      };
    }
  );

  // --------------------------------------------------------------------------
  // RESOURCE: Kompletter Bandplan
  // --------------------------------------------------------------------------
  server.resource(
    "bandplan://iaru-region1/complete",
    "Vollständiger IARU Region 1 Bandplan als JSON",
    async () => ({
      contents: [{
        uri: "bandplan://iaru-region1/complete",
        mimeType: "application/json",
        text: JSON.stringify({
          region: "IARU Region 1",
          country: "Österreich (OE)",
          source: "oeradio.at",
          bands: BAND_PLANS
        }, null, 2)
      }]
    })
  );

  // --------------------------------------------------------------------------
  // RESOURCE: Kabel-Datenbank
  // --------------------------------------------------------------------------
  server.resource(
    "cables://coaxial/all",
    "Dämpfungsdaten aller Koaxialkabel",
    async () => ({
      contents: [{
        uri: "cables://coaxial/all",
        mimeType: "application/json",
        text: JSON.stringify({
          description: "Dämpfung in dB/100m bei verschiedenen Frequenzen (MHz)",
          cables: CABLE_DATA
        }, null, 2)
      }]
    })
  );

  // --------------------------------------------------------------------------
  // RESOURCE: Antennen-Datenbank
  // --------------------------------------------------------------------------
  server.resource(
    "antennas://gains/all",
    "Typische Gewinnwerte verschiedener Antennentypen",
    async () => ({
      contents: [{
        uri: "antennas://gains/all",
        mimeType: "application/json",
        text: JSON.stringify({
          description: "Typische Antennengewinne in dBi",
          antennas: ANTENNA_GAINS
        }, null, 2)
      }]
    })
  );

  return server;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const sessions = new Map<string, StreamableHTTPServerTransport>();

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

app.use(express.json());

// CORS für öffentlichen Zugriff
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "oeradio-mcp",
    version: "1.0.0",
    uptime: process.uptime(),
    sessions: sessions.size
  });
});

// Info Endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "oeradio.at MCP Server",
    version: "1.0.0",
    description: "Amateurfunk-Berechnungen für IARU Region 1",
    author: "OE8YML",
    endpoints: {
      mcp: "/mcp",
      health: "/health"
    },
    tools: [
      "get_band_plan",
      "list_all_bands", 
      "check_frequency",
      "calculate_eirp",
      "calculate_cable_loss",
      "compare_cables",
      "calculate_battery_runtime",
      "get_antenna_gain",
      "calculate_wavelength",
      "calculate_swr_loss",
      "convert_power"
    ],
    resources: [
      "bandplan://iaru-region1/complete",
      "cables://coaxial/all",
      "antennas://gains/all"
    ]
  });
});

// MCP Endpoint - POST (Requests)
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  
  let transport = sessionId ? sessions.get(sessionId) : undefined;
  
  if (!transport) {
    // Neue Session erstellen
    const server = createOeradioMcpServer();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport!);
        console.log(`[MCP] Neue Session: ${id}`);
      }
    });
    
    await server.connect(transport);
  }
  
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP] Request error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null
      });
    }
  }
});

// MCP Endpoint - GET (SSE Stream)
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = sessions.get(sessionId);
  
  if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No session found. Send POST first." },
      id: null
    });
    return;
  }
  
  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("[MCP] SSE error:", error);
  }
});

// MCP Endpoint - DELETE (Session beenden)
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport?.close();
    sessions.delete(sessionId);
    console.log(`[MCP] Session beendet: ${sessionId}`);
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

// ============================================================================
// SERVER STARTEN
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   📻 oeradio.at MCP Server                                 ║
║                                                            ║
║   Endpoint:  http://localhost:${PORT}/mcp                    ║
║   Health:    http://localhost:${PORT}/health                 ║
║   Info:      http://localhost:${PORT}/                       ║
║                                                            ║
║   Created by OE8YML - https://oeradio.at                   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
