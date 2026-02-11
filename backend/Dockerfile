# Multi-stage Dockerfile for RemedyIQ API/Worker
# Build context: repository root (not backend/)
# Usage: docker build -t remedyiq-api:latest -f backend/Dockerfile .

#############################################
# Stage 1: Builder
#############################################
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /build

# Copy go mod files first for better layer caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source code
COPY backend/ .

# Build binaries with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -trimpath \
    -o /bin/api \
    ./cmd/api/...

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -trimpath \
    -o /bin/worker \
    ./cmd/worker/...

#############################################
# Stage 2: Runtime (API)
#############################################
FROM alpine:3.19 AS api

RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    openjdk11-jre-headless

RUN addgroup -g 1000 remedyiq && \
    adduser -D -u 1000 -G remedyiq remedyiq

WORKDIR /app

COPY --from=builder /bin/api .
COPY ARLogAnalyzer.jar ./
COPY legacy/webTemplates/ ./webTemplates/

RUN mkdir -p /tmp/remedyiq-analysis && \
    chown -R remedyiq:remedyiq /app /tmp/remedyiq-analysis

USER remedyiq
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["./api"]

#############################################
# Stage 3: Runtime (Worker)
#############################################
FROM alpine:3.19 AS worker

RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    openjdk11-jre-headless

RUN addgroup -g 1000 remedyiq && \
    adduser -D -u 1000 -G remedyiq remedyiq

WORKDIR /app

COPY --from=builder /bin/worker .
COPY ARLogAnalyzer.jar ./
COPY legacy/webTemplates/ ./webTemplates/

RUN mkdir -p /tmp/remedyiq-analysis && \
    chown -R remedyiq:remedyiq /app /tmp/remedyiq-analysis

USER remedyiq

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD pgrep -f worker || exit 1

CMD ["./worker"]

#############################################
# Default target is API
#############################################
FROM api
