# Build stage - build the frontend
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY vite.config.js ./

# Install dependencies required to build frontend
RUN npm ci

# Copy source code
COPY src ./src
COPY index.html ./

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install curl for health checks (optional, can be removed if not needed)
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9902
ENV DATA_ROOT=/data

# Create data directory with correct permissions
RUN mkdir -p /data && chown -R nodejs:nodejs /app /data

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server code
COPY server ./server
COPY scripts ./scripts

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 9902

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9902/api/auth/salt?username=healthcheck || exit 1

# Start the server
CMD ["npm", "run", "runtime:docker"]
