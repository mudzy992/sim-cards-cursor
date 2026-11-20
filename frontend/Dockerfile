FROM node:20-alpine AS build

WORKDIR /usr/app

COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY mobile/package.json ./mobile/

RUN npm ci --workspace=@sim-tracker/shared --workspace=sim-tracker-frontend --include-workspace-root

COPY packages/shared ./packages/shared
COPY frontend ./frontend

ARG VITE_API_BASE_URL
ARG VITE_API_BASE_URLS

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_BASE_URLS=${VITE_API_BASE_URLS}

RUN npm run build --workspace=@sim-tracker/shared && npm run build --workspace=sim-tracker-frontend


FROM nginx:alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /usr/app/frontend/dist ./
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
