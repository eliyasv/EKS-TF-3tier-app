# Backend Dockerfile - Production Ready
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Change ownership to the built-in non-root node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Document the port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/healthz || exit 1

# Start the application
CMD ["node", "index.js"]
