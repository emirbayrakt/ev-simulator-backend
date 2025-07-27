# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

ENV TZ=Europe/Berlin
RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo "$TZ" > /etc/timezone

# Install deps (include dev deps for TypeScript build)
COPY package*.json ./
RUN npm ci

# Copy full source
COPY . .

# Generate Prisma client (uses node_modules from this stage)
RUN npx prisma generate

# Compile TS -> dist/
RUN npm run build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Berlin
RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo "$TZ" > /etc/timezone

# Install only prod deps (postinstall will generate Prisma client)
COPY package*.json ./
RUN npm ci --omit=dev

# We still need the Prisma schema for migrate deploy
COPY prisma ./prisma

# Bring compiled JS only
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# IMPORTANT: do not use npx; call the local binary directly to avoid network
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
