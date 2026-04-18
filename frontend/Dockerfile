# Multi-stage Dockerfile for Next.js Frontend
# Uses Next.js standalone output for minimal production image

#############################################
# Stage 1: Dependencies
#############################################
FROM node:20-alpine AS deps

# Install libc6-compat for compatibility with some npm packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
# Use ci for reproducible builds
RUN npm ci --legacy-peer-deps

#############################################
# Stage 2: Builder
#############################################
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Browser calls the host-mapped API from the user's machine (not the frontend container).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
ARG NEXT_PUBLIC_DEV_MODE=true
ARG NEXT_PUBLIC_DEV_USER_ID=00000000-0000-0000-0000-000000000001
ARG NEXT_PUBLIC_DEV_TENANT_ID=00000000-0000-0000-0000-000000000001
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEV_MODE=$NEXT_PUBLIC_DEV_MODE
ENV NEXT_PUBLIC_DEV_USER_ID=$NEXT_PUBLIC_DEV_USER_ID
ENV NEXT_PUBLIC_DEV_TENANT_ID=$NEXT_PUBLIC_DEV_TENANT_ID
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Build application
# Next.js will automatically detect standalone mode from next.config.js
RUN npm run build

#############################################
# Stage 3: Runner
#############################################
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user for security
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs nextjs

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone build output
# This includes all necessary files: .next/standalone, .next/static, etc.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname to 0.0.0.0 to allow external connections
ENV HOSTNAME "0.0.0.0"
ENV PORT 3000

# Health check - uses the root page as liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', (res) => { process.exit(res.statusCode < 400 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start Next.js server
CMD ["node", "server.js"]
