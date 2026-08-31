FROM node:20-alpine AS build

WORKDIR /usr/app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_API_BASE_URLS

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_BASE_URLS=${VITE_API_BASE_URLS}

RUN npm run build


FROM nginx:alpine AS runtime

WORKDIR /usr/share/nginx/html

COPY --from=build /usr/app/dist ./
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
