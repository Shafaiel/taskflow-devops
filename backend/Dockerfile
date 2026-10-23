# ---------- Stage 1: install production dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: small runtime image ----------
FROM node:20-alpine
LABEL maintainer="TaskFlow DevOps Lab" \
      description="TaskFlow REST API (Node.js + Express)"

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Copy only what is needed to run, owned by the unprivileged 'node' user
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
