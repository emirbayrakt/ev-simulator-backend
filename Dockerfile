FROM node:22-alpine

# Set working directory and timezone
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Berlin

# Install system dependencies for Prisma and timezone
RUN apk add --no-cache tzdata \
  && cp /usr/share/zoneinfo/$TZ /etc/localtime \
  && echo "$TZ" > /etc/timezone

# Copy package files and install all dependencies including dev
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript to JavaScript
RUN npm run build

# Remove devDependencies to keep image small
RUN npm prune --omit=dev

# Run DB migration and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node build/index.js"]

EXPOSE 4000