# oeradio.at MCP Server 📻 (Docker Edition)

Öffentlicher Model Context Protocol (MCP) Server für Amateurfunk-Berechnungen und Informationen.

**Erstellt von OE8YML** | [oeradio.at](https://oeradio.at)

## 🐳 Quick Start mit Docker

```bash
# Repository klonen
git clone https://github.com/oe8yml/oeradio-mcp.git
cd oeradio-mcp

# Container bauen und starten
docker compose up -d

# Logs anzeigen
docker compose logs -f
```

Server läuft dann auf: `http://localhost:3000/mcp`

## 🌐 Öffentlich erreichbar machen

### Option 1: Cloudflare Tunnel (empfohlen)

```bash
# 1. Tunnel erstellen (einmalig)
cloudflared tunnel create oeradio-mcp

# 2. Tunnel mit Domain verknüpfen
cloudflared tunnel route dns oeradio-mcp mcp.oeradio.at

# 3. Token kopieren
cloudflared tunnel token oeradio-mcp

# 4. .env erstellen
cp .env.example .env
# TUNNEL_TOKEN= eintragen

# 5. Mit Tunnel starten
docker compose --profile tunnel up -d
```

Danach erreichbar unter: `https://mcp.oeradio.at/mcp`

### Option 2: Reverse Proxy (Traefik/Nginx)

docker-compose.yml enthält bereits Traefik-Labels. Passe die Domain an:

```yaml
labels:
  - "traefik.http.routers.oeradio-mcp.rule=Host(`mcp.deine-domain.at`)"
```

### Option 3: Direkt mit Port-Forwarding

```bash
# Port 3000 im Router freigeben (nicht empfohlen für Production)
docker compose up -d
```

## 📁 Projektstruktur

```
oeradio-mcp-docker/
├── src/
│   └── index.ts          # MCP Server Code
├── Dockerfile            # Multi-stage Build
├── docker-compose.yml    # Container-Konfiguration
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 Verfügbare Tools

| Tool | Beschreibung |
|------|--------------|
| `get_band_plan` | IARU Region 1 Bandplan für ein Band |
| `list_all_bands` | Alle Amateurfunkbänder auflisten |
| `check_frequency` | Prüfen ob Frequenz erlaubt ist |
| `calculate_eirp` | EIRP/ERP berechnen |
| `calculate_cable_loss` | Kabeldämpfung berechnen |
| `compare_cables` | Alle Kabeltypen vergleichen |
| `calculate_battery_runtime` | Akkulaufzeit berechnen |
| `get_antenna_gain` | Antennengewinn nachschlagen |
| `calculate_wavelength` | Wellenlänge + Antennenlängen |
| `calculate_swr_loss` | SWR zu Verlust umrechnen |
| `convert_power` | Watt ↔ dBm ↔ dBW |

## 🔌 Client-Konfiguration

### Claude Desktop / Claude Code

In `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oeradio": {
      "type": "streamable-http",
      "url": "https://mcp.oeradio.at/mcp"
    }
  }
}
```

### Lokale Nutzung

```json
{
  "mcpServers": {
    "oeradio": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Für Clients die nur stdio unterstützen

Verwende [mcp-remote](https://github.com/anthropics/mcp-remote):

```json
{
  "mcpServers": {
    "oeradio": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.oeradio.at/mcp"]
    }
  }
}
```

## 🛠️ Entwicklung

```bash
# Dependencies installieren
npm install

# Dev-Server mit Hot-Reload
npm run dev

# TypeScript kompilieren
npm run build

# Production starten
npm start
```

## 📊 API Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/` | GET | Server-Info und Tool-Liste |
| `/health` | GET | Health Check |
| `/mcp` | POST | MCP JSON-RPC Requests |
| `/mcp` | GET | MCP SSE Stream |
| `/mcp` | DELETE | Session beenden |

### Health Check Response

```json
{
  "status": "ok",
  "server": "oeradio-mcp",
  "version": "1.0.0",
  "uptime": 12345.67,
  "sessions": 3
}
```

## 🔒 Sicherheit

- **Read-Only**: Alle Tools führen nur Berechnungen durch
- **Non-Root**: Container läuft als unprivilegierter User
- **No Secrets**: Keine API-Keys oder sensible Daten
- **CORS**: Konfigurierbar für spezifische Origins

### Rate Limiting hinzufügen (optional)

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100 // Max 100 Requests pro IP
});

app.use('/mcp', limiter);
```

## 🖥️ Raspberry Pi Deployment

```bash
# Auf dem Pi
git clone https://github.com/oe8yml/oeradio-mcp.git
cd oeradio-mcp

# ARM-kompatibles Image bauen
docker compose build

# Starten
docker compose up -d

# Mit Cloudflare Tunnel für globalen Zugriff
docker compose --profile tunnel up -d
```

Image-Größe: ~180MB (Alpine-basiert)

## 📈 Monitoring

### Docker Stats

```bash
docker stats oeradio-mcp
```

### Logs

```bash
# Live-Logs
docker compose logs -f

# Letzte 100 Zeilen
docker compose logs --tail=100
```

### Prometheus Metrics (optional)

Füge zu `src/index.ts` hinzu:

```typescript
import promClient from 'prom-client';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

## 🔄 Updates

```bash
# Neuen Code pullen
git pull

# Container neu bauen und starten
docker compose up -d --build
```

## 📜 Lizenz

MIT License - Frei verwendbar für die Amateurfunk-Community.

## 🔗 Links

- [oeradio.at](https://oeradio.at) - Weitere Ham Radio Tools
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)

---

73 de OE8YML 📻
