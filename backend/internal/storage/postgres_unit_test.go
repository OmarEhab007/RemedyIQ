package storage

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// IsNotFound
// ---------------------------------------------------------------------------

func TestIsNotFound(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "nil error returns false",
			err:      nil,
			expected: false,
		},
		{
			name:     "pgx.ErrNoRows returns true",
			err:      pgx.ErrNoRows,
			expected: true,
		},
		{
			name:     "error containing 'not found' returns true",
			err:      fmt.Errorf("postgres: tenant not found: abc-123"),
			expected: true,
		},
		{
			name:     "error containing 'not found' in middle returns true",
			err:      fmt.Errorf("record not found in database"),
			expected: true,
		},
		{
			name:     "wrapped pgx.ErrNoRows without not found in message returns false",
			err:      fmt.Errorf("query failed: %w", pgx.ErrNoRows),
			expected: false,
		},
		{
			name:     "generic error returns false",
			err:      fmt.Errorf("connection refused"),
			expected: false,
		},
		{
			name:     "timeout error returns false",
			err:      fmt.Errorf("context deadline exceeded"),
			expected: false,
		},
		{
			name:     "permission denied error returns false",
			err:      fmt.Errorf("permission denied"),
			expected: false,
		},
		{
			name:     "empty error message returns false",
			err:      fmt.Errorf(""),
			expected: false,
		},
		{
			name:     "error with 'Not Found' (capitalized) returns false",
			err:      fmt.Errorf("Resource Not Found"),
			expected: false,
		},
		{
			name:     "error with 'not found' at end returns true",
			err:      fmt.Errorf("job not found"),
			expected: true,
		},
		{
			name:     "error with 'not found' at start returns true",
			err:      fmt.Errorf("not found: resource xyz"),
			expected: true,
		},
		{
			name:     "postgres job not found format",
			err:      fmt.Errorf("postgres: job not found: 550e8400-e29b-41d4-a716-446655440000"),
			expected: true,
		},
		{
			name:     "postgres log file not found format",
			err:      fmt.Errorf("postgres: log file not found: 550e8400-e29b-41d4-a716-446655440000"),
			expected: true,
		},
		{
			name:     "postgres saved search not found format",
			err:      fmt.Errorf("postgres: saved search not found: 550e8400-e29b-41d4-a716-446655440000"),
			expected: true,
		},
		{
			name:     "postgres ai interaction not found format",
			err:      fmt.Errorf("postgres: ai interaction not found: 550e8400-e29b-41d4-a716-446655440000"),
			expected: true,
		},
		{
			name:     "postgres tenant not found for clerk org format",
			err:      fmt.Errorf("postgres: tenant not found for clerk org: org_abc"),
			expected: true,
		},
		{
			name:     "errors.New error returns false",
			err:      errors.New("some other error"),
			expected: false,
		},
		{
			name:     "errors.New with not found returns true",
			err:      errors.New("resource not found"),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsNotFound(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// IsNotFound with wrapped errors
// ---------------------------------------------------------------------------

func TestIsNotFound_WrappedErrors(t *testing.T) {
	// pgx.ErrNoRows wrapped with fmt.Errorf %w should be detected via
	// the equality check (errors.Is behavior with == comparison).
	baseErr := pgx.ErrNoRows
	wrapped := fmt.Errorf("layer 1: %w", baseErr)

	// Direct equality will not match a wrapped error, but the string
	// "not found" is not in the pgx.ErrNoRows message, so this depends
	// on how the wrapping error formats. pgx.ErrNoRows.Error() is
	// "no rows in result set" which does not contain "not found".
	// However, wrapped == pgx.ErrNoRows is false for wrapped errors.
	// This test documents the current behavior.
	assert.False(t, IsNotFound(wrapped),
		"wrapped pgx.ErrNoRows without 'not found' in message should return false for direct == check unless message contains 'not found'")

	// But if we wrap it with our own "not found" message, it works.
	wrappedWithMsg := fmt.Errorf("item not found: %w", baseErr)
	assert.True(t, IsNotFound(wrappedWithMsg))
}

// ---------------------------------------------------------------------------
// SetTenantContext UUID validation
// ---------------------------------------------------------------------------

func TestSetTenantContext_RejectsInvalidUUID(t *testing.T) {
	// Create a client with a nil pool. The UUID validation should reject
	// the input before any database call is made.
	client := &PostgresClient{pool: nil}

	tests := []struct {
		name     string
		tenantID string
	}{
		{"SQL injection attempt", "'; DROP TABLE tenants; --"},
		{"empty string", ""},
		{"random text", "not-a-uuid"},
		{"partial UUID", "550e8400-e29b-41d4"},
		{"special characters", "Robert'); DROP TABLE students;--"},
		{"too short", "abcdef"},
		{"too long", "550e8400-e29b-41d4-a716-446655440000-extra"},
		{"contains newline", "550e8400-e29b-41d4-a716\n446655440000"},
		{"null bytes", "550e8400-e29b-41d4-a716-4466554400\x00"},
		{"just dashes", "--------"},
		{"spaces only", "    "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.SetTenantContext(context.Background(), tt.tenantID)
			require.Error(t, err, "expected error for tenant ID %q", tt.tenantID)
			assert.Contains(t, err.Error(), "invalid tenant ID format")
		})
	}
}

func TestSetTenantContext_AcceptsValidUUID(t *testing.T) {
	// With a nil pool the Exec call will panic. We use recover to verify
	// that the UUID validation passed (no format error) and the code
	// proceeded to the database call.
	client := &PostgresClient{pool: nil}

	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic from nil pool, but call succeeded")
		}
		// Panic from nil pool means UUID validation passed.
	}()

	_ = client.SetTenantContext(context.Background(), "550e8400-e29b-41d4-a716-446655440000")
}

func TestSetTenantContext_AcceptsMultipleValidUUIDs(t *testing.T) {
	client := &PostgresClient{pool: nil}

	validUUIDs := []string{
		"550e8400-e29b-41d4-a716-446655440000",
		"00000000-0000-0000-0000-000000000000",
		"ffffffff-ffff-ffff-ffff-ffffffffffff",
		"123e4567-e89b-12d3-a456-426614174000",
	}

	for _, uid := range validUUIDs {
		t.Run(uid, func(t *testing.T) {
			// Each valid UUID should pass validation and then panic
			// when it tries to use the nil pool.
			func() {
				defer func() {
					r := recover()
					if r == nil {
						t.Fatal("expected panic from nil pool")
					}
				}()
				_ = client.SetTenantContext(context.Background(), uid)
			}()
		})
	}
}

// ---------------------------------------------------------------------------
// IsNotFound: idempotent calls
// ---------------------------------------------------------------------------

func TestIsNotFound_Idempotent(t *testing.T) {
	err := fmt.Errorf("record not found")
	// Multiple calls with the same error should always return the same result.
	assert.True(t, IsNotFound(err))
	assert.True(t, IsNotFound(err))
	assert.True(t, IsNotFound(err))

	assert.False(t, IsNotFound(nil))
	assert.False(t, IsNotFound(nil))
}

// ---------------------------------------------------------------------------
// IsNotFound: all package error patterns
// ---------------------------------------------------------------------------

func TestIsNotFound_PackageErrorPatterns(t *testing.T) {
	// Test all the "not found" error patterns that the postgres.go file
	// actually produces, to ensure IsNotFound catches every one.
	patterns := []string{
		"postgres: tenant not found: %s",
		"postgres: tenant not found for clerk org: %s",
		"postgres: log file not found: %s",
		"postgres: job not found: %s",
		"postgres: ai interaction not found: %s",
		"postgres: saved search not found: %s",
	}

	for _, pattern := range patterns {
		t.Run(pattern, func(t *testing.T) {
			msg := fmt.Sprintf(pattern, "some-id")
			err := errors.New(msg)
			assert.True(t, IsNotFound(err), "IsNotFound should return true for %q", err.Error())
		})
	}
}

// ---------------------------------------------------------------------------
// IsNotFound: non-matching error patterns from the package
// ---------------------------------------------------------------------------

func TestIsNotFound_NonMatchingPackageErrors(t *testing.T) {
	// These are error patterns from postgres.go that should NOT be
	// detected as "not found" errors.
	patterns := []string{
		"postgres: parse config: invalid dsn",
		"postgres: connect: connection refused",
		"postgres: ping: timeout",
		"postgres: set tenant context: permission denied",
		"postgres: create tenant: duplicate key",
		"postgres: get tenant: connection reset",
		"postgres: create log file: disk full",
		"postgres: scan log file: unexpected EOF",
		"postgres: create job: foreign key violation",
		"postgres: update job status: deadlock detected",
		"postgres: list jobs: connection pool exhausted",
	}

	for _, msg := range patterns {
		t.Run(msg, func(t *testing.T) {
			err := errors.New(msg)
			assert.False(t, IsNotFound(err), "IsNotFound should return false for %q", msg)
		})
	}
}
