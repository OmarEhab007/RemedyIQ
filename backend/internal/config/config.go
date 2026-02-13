package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration.
type Config struct {
	// Server
	APIPort    string
	WorkerMode bool

	// PostgreSQL
	PostgresURL string

	// ClickHouse
	ClickHouseURL string

	// NATS
	NATSURL string

	// Redis
	RedisURL string

	// S3 / MinIO
	S3Endpoint               string
	S3AccessKey              string
	S3SecretKey              string
	S3Bucket                 string
	S3UseSSL                 bool
	S3SkipBucketVerification bool // Skip bucket existence check (useful for MinIO dev)

	// JAR
	JARPath          string
	JARDefaultHeapMB int
	JARTimeoutSec    int

	// Clerk Auth
	ClerkSecretKey string

	// Anthropic AI
	AnthropicAPIKey string

	// App
	Environment string // development, staging, production
	LogLevel    string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		APIPort:                  getEnv("API_PORT", "8080"),
		PostgresURL:              getEnv("POSTGRES_URL", "postgres://remedyiq:remedyiq@localhost:5432/remedyiq?sslmode=disable"),
		ClickHouseURL:            getEnv("CLICKHOUSE_URL", "clickhouse://localhost:9004/remedyiq"),
		NATSURL:                  getEnv("NATS_URL", "nats://localhost:4222"),
		RedisURL:                 getEnv("REDIS_URL", "redis://localhost:6379"),
		S3Endpoint:               getEnv("S3_ENDPOINT", "http://localhost:9002"),
		S3AccessKey:              getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:              getEnv("S3_SECRET_KEY", "minioadmin"),
		S3Bucket:                 getEnv("S3_BUCKET", "remedyiq-logs"),
		S3UseSSL:                 getEnvBool("S3_USE_SSL", false),
		S3SkipBucketVerification: getEnvBool("S3_SKIP_BUCKET_VERIFICATION", true), // Default to true for MinIO dev
		JARPath:                  getEnv("JAR_PATH", "./ARLogAnalyzer/ARLogAnalyzer-3/ARLogAnalyzer.jar"),
		JARDefaultHeapMB:         getEnvInt("JAR_DEFAULT_HEAP_MB", 4096),
		JARTimeoutSec:            getEnvInt("JAR_TIMEOUT_SEC", 1800),
		ClerkSecretKey:           getEnv("CLERK_SECRET_KEY", ""),
		AnthropicAPIKey:          getEnv("ANTHROPIC_API_KEY", ""),
		Environment:              getEnv("ENVIRONMENT", "development"),
		LogLevel:                 getEnv("LOG_LEVEL", "info"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.PostgresURL == "" {
		return fmt.Errorf("POSTGRES_URL is required")
	}
	if c.ClickHouseURL == "" {
		return fmt.Errorf("CLICKHOUSE_URL is required")
	}
	if c.NATSURL == "" {
		return fmt.Errorf("NATS_URL is required")
	}
	return nil
}

// IsDevelopment returns true if running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
