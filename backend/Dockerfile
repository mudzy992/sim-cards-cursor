# STAGE 1: BUILD
FROM node:24-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /usr/app

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm ci --workspace=@sim-tracker/shared --workspace=sim-tracker-backend --include-workspace-root

COPY packages/shared ./packages/shared
RUN npm run build --workspace=@sim-tracker/shared

COPY backend/prisma ./backend/prisma
RUN ./node_modules/.bin/prisma generate --schema=backend/prisma/schema.prisma

COPY backend ./backend
RUN npm run build --workspace=sim-tracker-backend


# STAGE 2: RUNTIME
FROM node:24-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm ci --omit=dev --workspace=@sim-tracker/shared --workspace=sim-tracker-backend --include-workspace-root

COPY --from=build --chown=node:node /usr/app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /usr/app/backend/dist ./dist
COPY --from=build --chown=node:node /usr/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /usr/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=node:node /usr/app/backend/prisma ./prisma
COPY --from=build --chown=node:node /usr/app/backend/src/templates ./templates

# Kontejner radi pod non-root korisnikom `node` (UID/GID 1000). Na hostu za
# bind-mount (/mnt/shared-app-files/sim-cards-codex) osigurati:
#   chown -R 1000:1000 /mnt/shared-app-files/sim-cards-codex
RUN mkdir -p /app/uploads /usr/app/uploads && chown -R node:node /usr/app /app/uploads

USER node

EXPOSE 3003

CMD ["node", "dist/src/main.js"]
