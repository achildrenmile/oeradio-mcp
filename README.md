# OERadio MCP Server

Public MCP (Model Context Protocol) server providing amateur radio tools and calculations for IARU Region 1 operators.

**Endpoint:** https://oeradio-mcp.oeradio.at/mcp
**Author:** OE8YML
**License:** MIT

## What is MCP?

Model Context Protocol (MCP) is an open standard that allows AI assistants to use external tools. Originally developed by Anthropic, MCP is now supported by Claude, ChatGPT, and Gemini. With this server, you can ask your AI assistant questions like "What are the band limits for 20m?" or "How long should my dipol be for 14.2 MHz?" and get instant calculations.

## Supported AI Assistants

| Platform | MCP Support | Notes |
|----------|-------------|-------|
| Claude Desktop | Yes | Full support |
| Claude Code (CLI) | Yes | Full support |
| ChatGPT Desktop | Yes | Requires Developer Mode (Pro/Plus/Team/Enterprise) |
| Gemini CLI | Yes | Since December 2025 |
| claude.ai (web) | No | Desktop app only |
| chatgpt.com (web) | No | Desktop app only |

## Available Tools

### Radio Calculation Tools

| Tool | Description |
|------|-------------|
| `get_band_plan` | Get IARU Region 1 band plan for a specific band |
| `list_all_bands` | List all amateur radio bands |
| `check_frequency` | Check if a frequency is within amateur bands |
| `calculate_eirp` | Calculate EIRP/ERP from power, cable loss, and antenna gain |
| `calculate_cable_loss` | Calculate coaxial cable attenuation |
| `compare_cables` | Compare all cable types at a given frequency and length |
| `calculate_battery_runtime` | Calculate battery runtime for portable operation |
| `get_antenna_gain` | Look up typical antenna gain values |
| `calculate_wavelength` | Calculate wavelength and antenna lengths |
| `calculate_swr_loss` | Calculate power loss from SWR mismatch |
| `convert_power` | Convert between Watt, dBm, and dBW |

### Austrian Callsign Tools

| Tool | Description |
|------|-------------|
| `callsign_lookup` | Search Austrian callsigns (fb.gv.at, QRZ.com, HamQTH fallback) |
| `callsign_available` | Check if a suffix is available across Austrian districts |
| `callsign_suggest` | Generate callsign suggestions based on name |
| `callsign_validate` | Validate callsigns against Austrian rules |
| `callsign_database_info` | Show database version and statistics |

The callsign tools use the official Austrian callsign list from fb.gv.at as the primary data source. External lookups (QRZ.com, HamQTH) include warnings when a callsign is found externally but not in the official list.

## Available Resources

| URI | Description |
|-----|-------------|
| `bandplan://iaru-region1/complete` | Complete IARU Region 1 band plan |
| `cables://coaxial/all` | Attenuation data for all coaxial cables |
| `antennas://gains/all` | Typical antenna gain values |
| `callsigns://districts` | Austrian amateur radio districts (OE1-OE9) |
| `callsigns://license-classes` | Austrian license class information |

## Supported Data

### Bands (IARU Region 1)
2200m, 630m, 160m, 80m, 60m, 40m, 30m, 20m, 17m, 15m, 12m, 10m, 6m, 2m, 70cm, 23cm, 13cm

### Coaxial Cables
RG58, RG213, H2000Flex, Aircell7, Ecoflex10, Ecoflex15, LMR400, LMR600

### Antenna Types
Dipol, Groundplane, Vertical, Yagi (3/5/7 elements), Quad (2 elements), J-Pole, Slim Jim, Collinear (X50/X200/X510)

### Austrian Callsign Data
- **Source:** Official callsign list from fb.gv.at (Fernmeldebüro)
- **Updates:** Automatic monthly updates via GitHub Actions
- **Districts:** OE1 (Wien), OE2 (Salzburg), OE3 (NÖ), OE4 (Burgenland), OE5 (OÖ), OE6 (Steiermark), OE7 (Tirol), OE8 (Kärnten), OE9 (Vorarlberg)
- **License Classes:** Class 1 (CEPT full), Class 3 (CEPT restricted), Class 4 (Beginner)

The callsign database is updated automatically on the 2nd of each month and contains ~7,500 entries.

## Client Configuration

### Claude Desktop

Add to your configuration file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "oeradio": {
      "type": "streamable-http",
      "url": "https://oeradio-mcp.oeradio.at/mcp"
    }
  }
}
```

### Claude Code (CLI)

Add to `~/.config/claude/settings.json`:

```json
{
  "mcpServers": {
    "oeradio": {
      "type": "streamable-http",
      "url": "https://oeradio-mcp.oeradio.at/mcp"
    }
  }
}
```

### ChatGPT (Developer Mode)

Requires ChatGPT Pro, Plus, Team, or Enterprise account.

1. Go to **Settings > Connectors > Advanced**
2. Enable **Developer Mode**
3. Click **Create** and enter:
   - Name: `OERadio`
   - URL: `https://oeradio-mcp.oeradio.at/mcp`
4. In chat: Click **+ > More > Developer mode** and select OERadio

### Gemini CLI

Add the server using the command:

```bash
gemini mcp add --transport http oeradio https://oeradio-mcp.oeradio.at/mcp
```

Or add to your settings.json:

```json
{
  "mcpServers": {
    "oeradio": {
      "url": "https://oeradio-mcp.oeradio.at/mcp"
    }
  }
}
```

### Clients with stdio only

```json
{
  "mcpServers": {
    "oeradio": {
      "command": "npx",
      "args": ["mcp-remote", "https://oeradio-mcp.oeradio.at/mcp"]
    }
  }
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info and tool list |
| `/health` | GET | Health check |
| `/mcp` | POST | MCP JSON-RPC requests |
| `/mcp` | GET | MCP SSE stream (with session ID) |
| `/mcp` | DELETE | End session |

## Self-Hosting

### Requirements
- Node.js 20+
- Docker (optional)

### Docker

```bash
docker build -t oeradio-mcp .
docker run -d -p 3000:3000 --name oeradio-mcp oeradio-mcp
```

### Docker Compose

```bash
docker compose up -d
```

### Manual

```bash
npm install
npm run build
npm start
```

## Development

```bash
npm install
npm run dev
```

## Registry

This server is published to the MCP Registry:
- **Name:** `io.github.achildrenmile/oeradio-mcp`
- **Version:** 1.0.0

## Links

- Website: https://oeradio.at
- MCP Endpoint: https://oeradio-mcp.oeradio.at/mcp
- Health Check: https://oeradio-mcp.oeradio.at/health
- GitHub: https://github.com/achildrenmile/oeradio-mcp

## License

MIT

---

73 de OE8YML
