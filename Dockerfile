# --- Stage 1: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

ENV TZ=Europe/Berlin

# Install system tzdata
RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo "$TZ" > /etc/timezone

# Copy and install ALL dependencies
COPY package*.json ./
RUN npm ci

# Copy source and prisma
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript project
RUN npm run build


# --- Stage 2: Runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Berlin

RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo "$TZ" > /etc/timezone

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built code and Prisma client
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# If you have migrations or seed scripts
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

# Run migrations and start app
CMD ["sh", "-c", "npx prisma migrate deploy && node build/index.js"]

EXPOSE 4000
