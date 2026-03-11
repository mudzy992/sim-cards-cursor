FROM node:20-alpine AS build

WORKDIR /usr/app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY prisma ./prisma

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

CMD ["node", "dist/main.js"]

