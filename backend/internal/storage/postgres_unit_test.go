package storage

import (
	"context"
	"testing"
)

func TestSetTenantContext_RejectsInvalidUUID(t *testing.T) {
	// Create a client with a nil pool — we expect the UUID validation
	// to reject the input before any database call is made.
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := client.SetTenantContext(context.Background(), tt.tenantID)
			if err == nil {
				t.Fatalf("expected error for tenant ID %q, got nil", tt.tenantID)
			}
			if got := err.Error(); len(got) == 0 {
				t.Fatal("expected non-empty error message")
			}
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
		// Panic from nil pool means UUID validation passed — success.
	}()

	_ = client.SetTenantContext(context.Background(), "550e8400-e29b-41d4-a716-446655440000")
}
