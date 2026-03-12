# --- STAGE 1: Build ---
FROM node:20 AS build

WORKDIR /usr/app

# Kopiramo samo datoteke potrebne za instalaciju dependencija
COPY package*.json ./
COPY prisma ./prisma

# Instaliramo sve (uključujući devDependencies za build)
RUN npm ci

# Generiramo Prisma Client (ovdje će povući ispravan engine za Debian)
RUN npx prisma generate

# Kopiramo ostatak koda i buildamo aplikaciju
COPY . .
RUN npm run build

# --- STAGE 2: Runtime ---
FROM node:20 AS runtime

WORKDIR /usr/app

# Sistemske dependencije potrebne za Chrome/Puppeteer
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
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
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Kopiramo samo ono što je nužno za rad aplikacije
COPY --from=build /usr/app/package*.json ./
COPY --from=build /usr/app/node_modules ./node_modules
COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/prisma ./prisma

# Instaliramo Chrome za Puppeteer (managed browser)
RUN npx puppeteer browsers install chrome

# Volumen za upload datoteka
VOLUME ["/usr/app/uploads"]

EXPOSE 3003

# Pokretanje aplikacije
CMD ["node", "dist/src/main.js"]
