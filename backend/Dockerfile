FROM node:20 AS build

WORKDIR /usr/app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN npm run build

FROM node:20 AS runtime

WORKDIR /usr/app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY --from=build /usr/app/dist ./dist

VOLUME ["/usr/app/uploads"]

EXPOSE 3003

CMD ["node", "dist/src/main.js"]
