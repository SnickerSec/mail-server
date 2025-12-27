# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for building
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build:server
RUN npx prisma generate

# Dashboard build stage
FROM node:20-alpine AS dashboard-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

# Copy built files (includes compiled Prisma client in dist/generated/)
COPY --from=builder /app/dist ./dist/
COPY --from=dashboard-builder /app/dashboard/dist ./public/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Wait for database and push schema, then start server
CMD ["sh", "-c", "\
  echo 'Waiting for database...' && \
  for i in 1 2 3 4 5 6 7 8 9 10; do \
    npx prisma db push --url \"$DATABASE_URL\" && break; \
    echo \"Database not ready, retry $i/10 in 5s...\"; \
    sleep 5; \
  done && \
  node dist/index.js"]
