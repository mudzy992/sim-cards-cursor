# STAGE 1: BUILD
FROM node:24-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

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

RUN npm ci --omit=dev

COPY --from=build /usr/app/dist ./dist
COPY --from=build /usr/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /usr/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /usr/app/prisma ./prisma
COPY --from=build /usr/app/src/templates ./templates

EXPOSE 3003

CMD ["node", "dist/src/main.js"]
