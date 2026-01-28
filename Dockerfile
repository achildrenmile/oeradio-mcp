# oeradio.at MCP Server
# Multi-stage build für minimale Image-Größe

# ============================================================================
# Build Stage
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Package files kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm ci

# Source kopieren
COPY tsconfig.json ./
COPY src ./src

# TypeScript kompilieren
RUN npm run build

# Nur Production Dependencies behalten
RUN npm ci --only=production && npm cache clean --force

# ============================================================================
# Production Stage
# ============================================================================
FROM node:22-alpine AS production

# Security: Non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp

WORKDIR /app

# Nur das Nötigste vom Builder kopieren
COPY --from=builder --chown=mcp:mcp /app/dist ./dist
COPY --from=builder --chown=mcp:mcp /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:mcp /app/package.json ./

# Als non-root User ausführen
USER mcp

# Port
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Starten
CMD ["node", "dist/index.js"]
