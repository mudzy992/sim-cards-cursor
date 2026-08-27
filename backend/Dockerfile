# STAGE 1: BUILD
FROM node:24-slim AS build
# Prisma treba openssl u slim verziji
RUN apt-get update && apt-get install -y openssl
# Build stage ne pokreće Puppeteer (samo tsc kompajliranje) — preskoči
# preuzimanje Chromium-a ovdje da se izbjegne nepotreban download/rizik
# od flaky CDN-a; sistemski Chromium se instalira samo u runtime stage.
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /usr/app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

# STAGE 2: RUNTIME
FROM node:24-slim AS runtime
# Instalacija samo najnužnijeg za Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/app

# Okolišne varijable za Puppeteer da koristi sistemski Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev

# Kopiraj samo gotov build i generirani Prisma client iz build stagea
COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /usr/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /usr/app/prisma ./prisma
COPY --from=build /usr/app/src/templates ./templates

EXPOSE 3003
CMD ["node", "dist/src/main.js"]
