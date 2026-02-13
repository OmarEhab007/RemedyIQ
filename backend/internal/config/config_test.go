package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setEnvs sets multiple environment variables and returns a cleanup function.
func setEnvs(t *testing.T, vars map[string]string) {
	t.Helper()
	for k, v := range vars {
		t.Setenv(k, v)
	}
}

func TestLoad_DefaultValues(t *testing.T) {
	// With no env vars set, Load should succeed using all defaults.
	cfg, err := Load()
	require.NoError(t, err)
	require.NotNil(t, cfg)

	assert.Equal(t, "8080", cfg.APIPort)
	assert.Contains(t, cfg.PostgresURL, "localhost:5432")
	assert.Contains(t, cfg.ClickHouseURL, "localhost:9004")
	assert.Contains(t, cfg.NATSURL, "localhost:4222")
	assert.Contains(t, cfg.RedisURL, "localhost:6379")
	assert.Equal(t, "http://localhost:9002", cfg.S3Endpoint)
	assert.Equal(t, "minioadmin", cfg.S3AccessKey)
	assert.Equal(t, "minioadmin", cfg.S3SecretKey)
	assert.Equal(t, "remedyiq-logs", cfg.S3Bucket)
	assert.False(t, cfg.S3UseSSL)
	assert.True(t, cfg.S3SkipBucketVerification)
	assert.Equal(t, 4096, cfg.JARDefaultHeapMB)
	assert.Equal(t, 1800, cfg.JARTimeoutSec)
	assert.Equal(t, "", cfg.ClerkSecretKey)
	assert.Equal(t, "", cfg.AnthropicAPIKey)
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.False(t, cfg.WorkerMode)
}

func TestLoad_CustomEnvVars(t *testing.T) {
	setEnvs(t, map[string]string{
		"API_PORT":         "9090",
		"POSTGRES_URL":     "postgres://custom:custom@db:5432/app",
		"CLICKHOUSE_URL":   "clickhouse://ch:9000/logs",
		"NATS_URL":         "nats://nats:4222",
		"REDIS_URL":        "redis://redis:6379/1",
		"S3_ENDPOINT":      "https://s3.amazonaws.com",
		"S3_ACCESS_KEY":    "AKIA123",
		"S3_SECRET_KEY":    "secret123",
		"S3_BUCKET":        "prod-logs",
		"S3_USE_SSL":       "true",
		"S3_SKIP_BUCKET_VERIFICATION": "false",
		"JAR_DEFAULT_HEAP_MB":         "8192",
		"JAR_TIMEOUT_SEC":             "3600",
		"CLERK_SECRET_KEY":  "sk_test_abc",
		"ANTHROPIC_API_KEY": "sk-ant-abc",
		"ENVIRONMENT":       "production",
		"LOG_LEVEL":         "debug",
	})

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "9090", cfg.APIPort)
	assert.Equal(t, "postgres://custom:custom@db:5432/app", cfg.PostgresURL)
	assert.Equal(t, "clickhouse://ch:9000/logs", cfg.ClickHouseURL)
	assert.Equal(t, "nats://nats:4222", cfg.NATSURL)
	assert.Equal(t, "redis://redis:6379/1", cfg.RedisURL)
	assert.Equal(t, "https://s3.amazonaws.com", cfg.S3Endpoint)
	assert.Equal(t, "AKIA123", cfg.S3AccessKey)
	assert.Equal(t, "secret123", cfg.S3SecretKey)
	assert.Equal(t, "prod-logs", cfg.S3Bucket)
	assert.True(t, cfg.S3UseSSL)
	assert.False(t, cfg.S3SkipBucketVerification)
	assert.Equal(t, 8192, cfg.JARDefaultHeapMB)
	assert.Equal(t, 3600, cfg.JARTimeoutSec)
	assert.Equal(t, "sk_test_abc", cfg.ClerkSecretKey)
	assert.Equal(t, "sk-ant-abc", cfg.AnthropicAPIKey)
	assert.Equal(t, "production", cfg.Environment)
	assert.Equal(t, "debug", cfg.LogLevel)
}

func TestLoad_Validate_MissingPostgresURL(t *testing.T) {
	t.Setenv("POSTGRES_URL", "")
	// Also clear any defaults by setting to empty
	// The default is non-empty, so we need to override
	origPG := os.Getenv("POSTGRES_URL")
	os.Setenv("POSTGRES_URL", "")
	defer os.Setenv("POSTGRES_URL", origPG)

	// Since getEnv uses a non-empty fallback for POSTGRES_URL,
	// the default is always set. To test validation, we need a
	// Config with empty PostgresURL directly.
	cfg := &Config{
		PostgresURL:   "",
		ClickHouseURL: "clickhouse://localhost:9004/remedyiq",
		NATSURL:       "nats://localhost:4222",
	}
	err := cfg.validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "POSTGRES_URL is required")
}

func TestLoad_Validate_MissingClickHouseURL(t *testing.T) {
	cfg := &Config{
		PostgresURL:   "postgres://localhost:5432/db",
		ClickHouseURL: "",
		NATSURL:       "nats://localhost:4222",
	}
	err := cfg.validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CLICKHOUSE_URL is required")
}

func TestLoad_Validate_MissingNATSURL(t *testing.T) {
	cfg := &Config{
		PostgresURL:   "postgres://localhost:5432/db",
		ClickHouseURL: "clickhouse://localhost:9004/db",
		NATSURL:       "",
	}
	err := cfg.validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "NATS_URL is required")
}

func TestLoad_Validate_AllPresent(t *testing.T) {
	cfg := &Config{
		PostgresURL:   "postgres://localhost:5432/db",
		ClickHouseURL: "clickhouse://localhost:9004/db",
		NATSURL:       "nats://localhost:4222",
	}
	err := cfg.validate()
	require.NoError(t, err)
}

func TestIsDevelopment(t *testing.T) {
	tests := []struct {
		env  string
		want bool
	}{
		{"development", true},
		{"staging", false},
		{"production", false},
		{"", false},
		{"dev", false},
	}

	for _, tc := range tests {
		t.Run(tc.env, func(t *testing.T) {
			cfg := &Config{Environment: tc.env}
			assert.Equal(t, tc.want, cfg.IsDevelopment())
		})
	}
}

func TestGetEnv(t *testing.T) {
	t.Run("returns env value when set", func(t *testing.T) {
		t.Setenv("TEST_GET_ENV_KEY", "custom_value")
		assert.Equal(t, "custom_value", getEnv("TEST_GET_ENV_KEY", "fallback"))
	})

	t.Run("returns fallback when not set", func(t *testing.T) {
		os.Unsetenv("TEST_GET_ENV_KEY_MISSING")
		assert.Equal(t, "fallback", getEnv("TEST_GET_ENV_KEY_MISSING", "fallback"))
	})
}

func TestGetEnvInt(t *testing.T) {
	t.Run("returns parsed int when valid", func(t *testing.T) {
		t.Setenv("TEST_INT_KEY", "42")
		assert.Equal(t, 42, getEnvInt("TEST_INT_KEY", 99))
	})

	t.Run("returns fallback when not set", func(t *testing.T) {
		os.Unsetenv("TEST_INT_KEY_MISSING")
		assert.Equal(t, 99, getEnvInt("TEST_INT_KEY_MISSING", 99))
	})

	t.Run("returns fallback when invalid int", func(t *testing.T) {
		t.Setenv("TEST_INT_KEY_BAD", "not-a-number")
		assert.Equal(t, 99, getEnvInt("TEST_INT_KEY_BAD", 99))
	})
}

func TestGetEnvBool(t *testing.T) {
	t.Run("returns true when set to true", func(t *testing.T) {
		t.Setenv("TEST_BOOL_KEY", "true")
		assert.True(t, getEnvBool("TEST_BOOL_KEY", false))
	})

	t.Run("returns false when set to false", func(t *testing.T) {
		t.Setenv("TEST_BOOL_KEY", "false")
		assert.False(t, getEnvBool("TEST_BOOL_KEY", true))
	})

	t.Run("returns fallback when not set", func(t *testing.T) {
		os.Unsetenv("TEST_BOOL_KEY_MISSING")
		assert.True(t, getEnvBool("TEST_BOOL_KEY_MISSING", true))
	})

	t.Run("returns fallback when invalid bool", func(t *testing.T) {
		t.Setenv("TEST_BOOL_KEY_BAD", "maybe")
		assert.False(t, getEnvBool("TEST_BOOL_KEY_BAD", false))
	})

	t.Run("parses 1 as true", func(t *testing.T) {
		t.Setenv("TEST_BOOL_KEY_ONE", "1")
		assert.True(t, getEnvBool("TEST_BOOL_KEY_ONE", false))
	})

	t.Run("parses 0 as false", func(t *testing.T) {
		t.Setenv("TEST_BOOL_KEY_ZERO", "0")
		assert.False(t, getEnvBool("TEST_BOOL_KEY_ZERO", true))
	})
}
