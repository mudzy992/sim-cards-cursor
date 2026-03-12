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

# Kopiramo samo ono što je nužno za rad aplikacije
COPY --from=build /usr/app/package*.json ./
COPY --from=build /usr/app/node_modules ./node_modules
COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/prisma ./prisma

# Volumen za upload datoteka
VOLUME ["/usr/app/uploads"]

EXPOSE 3003

# Pokretanje aplikacije
CMD ["node", "dist/src/main.js"]
