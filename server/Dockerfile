FROM node:20-alpine

# Install OpenSSL required by Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/server.js"]
