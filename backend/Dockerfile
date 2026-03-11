FROM node:20-alpine AS build

WORKDIR /usr/app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma

# Generate Prisma client (needed so enums poput UserRole/UserStatus postoje u @prisma/client)
RUN npx prisma generate

COPY src ./src

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /usr/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /usr/app/dist ./dist
COPY prisma ./prisma

VOLUME ["/usr/app/uploads"]

EXPOSE 3003

CMD ["node", "dist/src/main.js"]

