# Use official Node.js LTS image on Alpine Linux
FROM node:22-alpine

# Set environment variables
ENV NODE_ENV=production

# Create and set working directory
WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source code
COPY . .

# Expose the application port (matches your code)
EXPOSE 3010

# Run as non-root user for security
RUN chown -R node:node /app
USER node

# Health check (customize endpoint as needed)
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:3010/health || exit 1

# Start the application
CMD ["npm", "start"]