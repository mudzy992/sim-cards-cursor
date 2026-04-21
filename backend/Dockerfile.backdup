# =========================
# STAGE 1: BUILD
# =========================
FROM node:20 AS build

WORKDIR /usr/app

# Kopiramo dependency manifest
COPY package*.json ./
COPY prisma ./prisma

# Instalacija (reproducibilno)
RUN npm ci

# Prisma client (Linux build context)
RUN npx prisma generate

# ostatak aplikacije
COPY . .

# build aplikacije (NestJS / TS)
RUN npm run build



# =========================
# STAGE 2: RUNTIME
# =========================
FROM node:20 AS runtime

WORKDIR /usr/app

# OS dependencies (Chrome + Puppeteer + fonts)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    chromium \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*


# =========================
# Dependencies (RUNTIME SAFE)
# =========================

COPY package*.json ./

# samo production deps (IMPORTANT)
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# =========================
# App artifacts
# =========================

COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/prisma ./prisma
COPY --from=build /usr/app/src/templates ./templates
COPY --from=build /usr/app/tsconfig.json ./tsconfig.json
COPY --from=build /usr/app/tsconfig.build.json ./tsconfig.build.json


# =========================
# Runtime config
# =========================

# (ako koristiš Puppeteer)
ENV PUPPETEER_SKIP_DOWNLOAD=true

VOLUME ["/usr/app/uploads"]

EXPOSE 3003

CMD ["node", "dist/src/main.js"]
