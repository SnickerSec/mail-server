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

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist/
COPY --from=dashboard-builder /app/dashboard/dist ./public/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run database migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
