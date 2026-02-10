# Multi-stage Dockerfile for RemedyIQ API/Worker
# Optimized for production with minimal image size and security best practices

#############################################
# Stage 1: Builder
#############################################
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binaries with optimizations
# - CGO_ENABLED=0: static binary, no C dependencies
# - -ldflags="-w -s": strip debug info for smaller binary
# - -trimpath: remove file system paths from binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -trimpath \
    -o /bin/api \
    ./cmd/api/...

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -trimpath \
    -o /bin/worker \
    ./cmd/worker/...

#############################################
# Stage 2: Runtime (API)
#############################################
FROM alpine:3.19 AS api

# Install runtime dependencies
# - ca-certificates: for HTTPS requests
# - tzdata: for timezone support
# - openjdk11-jre-headless: for ARLogAnalyzer.jar execution
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    openjdk11-jre-headless

# Create non-root user for security
RUN addgroup -g 1000 remedyiq && \
    adduser -D -u 1000 -G remedyiq remedyiq

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /bin/api .

# Copy ARLogAnalyzer.jar and templates (required for analysis)
COPY ARLogAnalyzer.jar ./
COPY webTemplates/ ./webTemplates/

# Create directories for temporary files
RUN mkdir -p /tmp/remedyiq-analysis && \
    chown -R remedyiq:remedyiq /app /tmp/remedyiq-analysis

# Switch to non-root user
USER remedyiq

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run API server
CMD ["./api"]

#############################################
# Stage 3: Runtime (Worker)
#############################################
FROM alpine:3.19 AS worker

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    openjdk11-jre-headless

# Create non-root user
RUN addgroup -g 1000 remedyiq && \
    adduser -D -u 1000 -G remedyiq remedyiq

WORKDIR /app

# Copy binary from builder
COPY --from=builder /bin/worker .

# Copy ARLogAnalyzer.jar and templates
COPY ARLogAnalyzer.jar ./
COPY webTemplates/ ./webTemplates/

# Create directories
RUN mkdir -p /tmp/remedyiq-analysis && \
    chown -R remedyiq:remedyiq /app /tmp/remedyiq-analysis

USER remedyiq

# Health check (checks if worker process is running)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD pgrep -f worker || exit 1

# Run worker
CMD ["./worker"]

#############################################
# Default target is API
#############################################
FROM api
