# Build stage
FROM node:20-alpine AS builder

ARG CACHEBUST=1
WORKDIR /app

# Install dependencies for building
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --prefer-offline=false

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
# Cache bust: 2025-12-25-v2
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

# Copy generated Prisma client from builder (already generated with correct version)
COPY --from=builder /app/src/generated ./src/generated/
# Copy prisma CLI and engines from builder for db push
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma/
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines/
COPY --from=builder /app/node_modules/@prisma/config ./node_modules/@prisma/config/
COPY --from=builder /app/node_modules/@prisma/dev ./node_modules/@prisma/dev/

# Copy built files
COPY --from=builder /app/dist ./dist/
COPY --from=dashboard-builder /app/dashboard/dist ./public/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Push schema to database and start server
CMD ["sh", "-c", "npx prisma db push --url \"$DATABASE_URL\" && node dist/index.js"]
