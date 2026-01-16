# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source and other config files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port (assuming 3000 as default for NestJS if not specified)
# Using common NestJS port
EXPOSE 3000

# Set environment variable to production
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "dist/main"]
