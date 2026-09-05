FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web apps/web
RUN npm run --workspace @rezzie/web build
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
