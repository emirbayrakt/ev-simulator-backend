FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Berlin

# Copy dependencies and install only prod packages
COPY package*.json ./
RUN npm ci --omit=dev

# Copy full source including prisma files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the TypeScript app
RUN npm run build

# Run migrations & start the app
CMD npx prisma migrate deploy && node build/index.js

# Optional: expose port if running locally
EXPOSE 4000