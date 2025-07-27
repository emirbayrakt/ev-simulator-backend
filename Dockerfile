FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Berlin

RUN apk add --no-cache tzdata \
 && cp /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo "$TZ" > /etc/timezone

# Install all dependencies (including dev, for ts-node and prisma)
COPY package*.json ./
RUN npm install

# Copy everything
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run DB migrations and start the server using ts-node
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node src/index.ts"]

EXPOSE 4000
