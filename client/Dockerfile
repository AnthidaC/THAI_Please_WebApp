# Stage 1: Build React app
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_MERCHANT_REQUIRE_DOCUMENTS=false
ENV VITE_MERCHANT_REQUIRE_DOCUMENTS=$VITE_MERCHANT_REQUIRE_DOCUMENTS

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
