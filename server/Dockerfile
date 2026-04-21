FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
      chromium fonts-liberation fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
# Puppeteer: skip Chromium download during install; use the system package instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json server/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm --filter=@csmp/shared build || true
WORKDIR /app/server
RUN pnpm prisma generate
RUN pnpm build
# Deploy: bundle server + flattened production deps into /deploy
WORKDIR /app
RUN pnpm --filter=@csmp/server --prod deploy /deploy

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r csmp && useradd -r -g csmp -m -d /home/csmp csmp
ENV HOME=/home/csmp
COPY --from=builder --chown=csmp:csmp /deploy/node_modules ./node_modules
COPY --from=builder --chown=csmp:csmp /deploy/package.json ./package.json
COPY --from=builder --chown=csmp:csmp /app/server/dist ./dist
COPY --from=builder --chown=csmp:csmp /app/server/prisma ./prisma
USER csmp
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed-banking-finance.mjs && node dist/index.js"]
