# OERadio MCP Server

Public MCP (Model Context Protocol) server providing amateur radio tools and calculations for IARU Region 1 operators.

**Endpoint:** https://oeradio-mcp.oeradio.at/mcp
**Author:** OE8YML
**License:** MIT

## What is MCP?

Model Context Protocol (MCP) is a standard that allows AI assistants like Claude to use external tools. With this server, you can ask your AI assistant questions like "What are the band limits for 20m?" or "How long should my dipol be for 14.2 MHz?" and get instant calculations.

## Available Tools

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

## Available Resources

| URI | Description |
|-----|-------------|
| `bandplan://iaru-region1/complete` | Complete IARU Region 1 band plan |
| `cables://coaxial/all` | Attenuation data for all coaxial cables |
| `antennas://gains/all` | Typical antenna gain values |

## Supported Data

### Bands (IARU Region 1)
2200m, 630m, 160m, 80m, 60m, 40m, 30m, 20m, 17m, 15m, 12m, 10m, 6m, 2m, 70cm, 23cm, 13cm

### Coaxial Cables
RG58, RG213, H2000Flex, Aircell7, Ecoflex10, Ecoflex15, LMR400, LMR600

### Antenna Types
Dipol, Groundplane, Vertical, Yagi (3/5/7 elements), Quad (2 elements), J-Pole, Slim Jim, Collinear (X50/X200/X510)

## Client Configuration

### Claude Desktop / Claude Code

Add to your MCP configuration file:

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
