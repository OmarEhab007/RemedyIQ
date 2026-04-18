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
# eclipse-temurin:11-jre (Ubuntu Jammy) uses glibc, so snappy-java's
# bundled native lib extracts and loads without any workaround.
#############################################
FROM eclipse-temurin:11-jre-jammy AS api

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 remedyiq && \
    useradd -u 1000 -g remedyiq -m -s /bin/sh remedyiq

WORKDIR /app

COPY --from=builder /bin/api .
COPY ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar ./
COPY ARLogAnalyzer/ARLogAnalyzer-3/webTemplates/ ./webTemplates/

RUN mkdir -p /tmp/remedyiq-analysis && \
    chown -R remedyiq:remedyiq /app /tmp/remedyiq-analysis

USER remedyiq
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/api/v1/health || exit 1

CMD ["./api"]

#############################################
# Stage 3: Runtime (Worker)
#############################################
FROM eclipse-temurin:11-jre-jammy AS worker

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 remedyiq && \
    useradd -u 1000 -g remedyiq -m -s /bin/sh remedyiq

WORKDIR /app

COPY --from=builder /bin/worker .
COPY ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar ./
COPY ARLogAnalyzer/ARLogAnalyzer-3/webTemplates/ ./webTemplates/

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
