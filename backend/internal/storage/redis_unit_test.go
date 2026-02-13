package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// TenantKey generation
// ---------------------------------------------------------------------------

func TestTenantKey(t *testing.T) {
	// TenantKey is a method on RedisClient. We can create a zero-value
	// client since the method does not touch the underlying redis connection.
	r := &RedisClient{}

	tests := []struct {
		name      string
		tenantID  string
		category  string
		id        string
		expected  string
	}{
		{
			name:     "full key with all parts",
			tenantID: "tenant-123",
			category: "dashboard",
			id:       "job-456",
			expected: "remedyiq:tenant-123:dashboard:job-456",
		},
		{
			name:     "key without id (empty id omitted)",
			tenantID: "tenant-123",
			category: "dashboard",
			id:       "",
			expected: "remedyiq:tenant-123:dashboard",
		},
		{
			name:     "uuid-style tenant id",
			tenantID: "550e8400-e29b-41d4-a716-446655440000",
			category: "search",
			id:       "query-789",
			expected: "remedyiq:550e8400-e29b-41d4-a716-446655440000:search:query-789",
		},
		{
			name:     "rate limit category",
			tenantID: "t1",
			category: "ratelimit",
			id:       "user-abc",
			expected: "remedyiq:t1:ratelimit:user-abc",
		},
		{
			name:     "cache category",
			tenantID: "t1",
			category: "cache",
			id:       "health-score",
			expected: "remedyiq:t1:cache:health-score",
		},
		{
			name:     "empty tenant and category with id",
			tenantID: "",
			category: "",
			id:       "something",
			expected: "remedyiq:::something",
		},
		{
			name:     "all empty",
			tenantID: "",
			category: "",
			id:       "",
			expected: "remedyiq::",
		},
		{
			name:     "category only",
			tenantID: "",
			category: "global",
			id:       "",
			expected: "remedyiq::global",
		},
		{
			name:     "special characters in tenant id",
			tenantID: "tenant:with:colons",
			category: "data",
			id:       "id",
			expected: "remedyiq:tenant:with:colons:data:id",
		},
		{
			name:     "spaces in values",
			tenantID: "tenant 1",
			category: "my category",
			id:       "my id",
			expected: "remedyiq:tenant 1:my category:my id",
		},
		{
			name:     "numeric tenant id",
			tenantID: "12345",
			category: "jobs",
			id:       "67890",
			expected: "remedyiq:12345:jobs:67890",
		},
		{
			name:     "long values",
			tenantID: "a-very-long-tenant-identifier-that-goes-on-and-on",
			category: "aggregates",
			id:       "a-very-long-resource-identifier",
			expected: "remedyiq:a-very-long-tenant-identifier-that-goes-on-and-on:aggregates:a-very-long-resource-identifier",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := r.TenantKey(tt.tenantID, tt.category, tt.id)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// TenantKey prefix consistency
// ---------------------------------------------------------------------------

func TestTenantKey_AlwaysStartsWithPrefix(t *testing.T) {
	r := &RedisClient{}

	tenantIDs := []string{"", "t1", "550e8400-e29b-41d4-a716-446655440000"}
	categories := []string{"", "cache", "dashboard", "ratelimit"}
	ids := []string{"", "id1", "complex-id-with-dashes"}

	for _, tid := range tenantIDs {
		for _, cat := range categories {
			for _, id := range ids {
				key := r.TenantKey(tid, cat, id)
				assert.Contains(t, key, "remedyiq:",
					"TenantKey(%q, %q, %q) should start with 'remedyiq:'", tid, cat, id)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// TenantKey id omission
// ---------------------------------------------------------------------------

func TestTenantKey_IdOmittedWhenEmpty(t *testing.T) {
	r := &RedisClient{}

	// When id is empty, the key should have exactly 3 parts (prefix:tenant:category)
	keyNoID := r.TenantKey("t1", "cache", "")
	assert.Equal(t, "remedyiq:t1:cache", keyNoID)

	// When id is non-empty, the key should have exactly 4 parts
	keyWithID := r.TenantKey("t1", "cache", "item1")
	assert.Equal(t, "remedyiq:t1:cache:item1", keyWithID)
}

// ---------------------------------------------------------------------------
// TenantKey determinism
// ---------------------------------------------------------------------------

func TestTenantKey_Deterministic(t *testing.T) {
	r := &RedisClient{}

	// The same inputs should always produce the same output.
	key1 := r.TenantKey("t1", "cache", "id1")
	key2 := r.TenantKey("t1", "cache", "id1")
	assert.Equal(t, key1, key2)
}

// ---------------------------------------------------------------------------
// TenantKey different inputs produce different keys
// ---------------------------------------------------------------------------

func TestTenantKey_DifferentInputsDifferentKeys(t *testing.T) {
	r := &RedisClient{}

	tests := []struct {
		name string
		a    [3]string
		b    [3]string
	}{
		{
			name: "different tenant IDs",
			a:    [3]string{"t1", "cache", "id1"},
			b:    [3]string{"t2", "cache", "id1"},
		},
		{
			name: "different categories",
			a:    [3]string{"t1", "cache", "id1"},
			b:    [3]string{"t1", "search", "id1"},
		},
		{
			name: "different ids",
			a:    [3]string{"t1", "cache", "id1"},
			b:    [3]string{"t1", "cache", "id2"},
		},
		{
			name: "id present vs absent",
			a:    [3]string{"t1", "cache", "id1"},
			b:    [3]string{"t1", "cache", ""},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			keyA := r.TenantKey(tt.a[0], tt.a[1], tt.a[2])
			keyB := r.TenantKey(tt.b[0], tt.b[1], tt.b[2])
			assert.NotEqual(t, keyA, keyB)
		})
	}
}
