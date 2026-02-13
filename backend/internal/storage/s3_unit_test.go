package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// GenerateKey
// ---------------------------------------------------------------------------

func TestGenerateKey(t *testing.T) {
	// GenerateKey is a method on S3Client but only uses the path.Join function
	// and does not touch the underlying S3 connection. A zero-bucket client
	// is sufficient.
	s := &S3Client{}

	tests := []struct {
		name      string
		tenantID  string
		jobID     string
		filename  string
		expected  string
	}{
		{
			name:     "basic key generation",
			tenantID: "tenant-123",
			jobID:    "job-456",
			filename: "server.log",
			expected: "tenants/tenant-123/jobs/job-456/server.log",
		},
		{
			name:     "uuid-style IDs",
			tenantID: "550e8400-e29b-41d4-a716-446655440000",
			jobID:    "660e8400-e29b-41d4-a716-446655440001",
			filename: "arserver.log",
			expected: "tenants/550e8400-e29b-41d4-a716-446655440000/jobs/660e8400-e29b-41d4-a716-446655440001/arserver.log",
		},
		{
			name:     "nested filename",
			tenantID: "t1",
			jobID:    "j1",
			filename: "nested/path/file.txt",
			expected: "tenants/t1/jobs/j1/nested/path/file.txt",
		},
		{
			name:     "filename with spaces replaced by path join",
			tenantID: "t1",
			jobID:    "j1",
			filename: "my file.log",
			expected: "tenants/t1/jobs/j1/my file.log",
		},
		{
			name:     "short IDs",
			tenantID: "a",
			jobID:    "b",
			filename: "c",
			expected: "tenants/a/jobs/b/c",
		},
		{
			name:     "filename with extension",
			tenantID: "t1",
			jobID:    "j1",
			filename: "archive.tar.gz",
			expected: "tenants/t1/jobs/j1/archive.tar.gz",
		},
		{
			name:     "filename with dots",
			tenantID: "t1",
			jobID:    "j1",
			filename: "server.2025.01.15.log",
			expected: "tenants/t1/jobs/j1/server.2025.01.15.log",
		},
		{
			name:     "filename with hyphens and underscores",
			tenantID: "t1",
			jobID:    "j1",
			filename: "server_log-2025-01-15.txt",
			expected: "tenants/t1/jobs/j1/server_log-2025-01-15.txt",
		},
		{
			name:     "numeric IDs",
			tenantID: "12345",
			jobID:    "67890",
			filename: "output.log",
			expected: "tenants/12345/jobs/67890/output.log",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := s.GenerateKey(tt.tenantID, tt.jobID, tt.filename)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ---------------------------------------------------------------------------
// GenerateKey format consistency
// ---------------------------------------------------------------------------

func TestGenerateKey_AlwaysStartsWithTenantsPrefix(t *testing.T) {
	s := &S3Client{}

	tenantIDs := []string{"t1", "abc-def", "550e8400-e29b-41d4-a716-446655440000"}
	jobIDs := []string{"j1", "xyz-123", "660e8400-e29b-41d4-a716-446655440001"}
	filenames := []string{"a.log", "deep/nested/file.txt", "server.log"}

	for _, tid := range tenantIDs {
		for _, jid := range jobIDs {
			for _, fn := range filenames {
				key := s.GenerateKey(tid, jid, fn)
				assert.Regexp(t, `^tenants/`, key,
					"GenerateKey(%q, %q, %q) should start with 'tenants/'", tid, jid, fn)
				assert.Contains(t, key, "/jobs/",
					"GenerateKey(%q, %q, %q) should contain '/jobs/'", tid, jid, fn)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// GenerateKey determinism
// ---------------------------------------------------------------------------

func TestGenerateKey_Deterministic(t *testing.T) {
	s := &S3Client{}

	key1 := s.GenerateKey("t1", "j1", "file.log")
	key2 := s.GenerateKey("t1", "j1", "file.log")
	assert.Equal(t, key1, key2)
}

// ---------------------------------------------------------------------------
// GenerateKey tenant isolation (different tenants produce different keys)
// ---------------------------------------------------------------------------

func TestGenerateKey_TenantIsolation(t *testing.T) {
	s := &S3Client{}

	key1 := s.GenerateKey("tenant-a", "job-1", "file.log")
	key2 := s.GenerateKey("tenant-b", "job-1", "file.log")
	assert.NotEqual(t, key1, key2, "different tenants should produce different keys")
}

// ---------------------------------------------------------------------------
// GenerateKey job isolation (different jobs produce different keys)
// ---------------------------------------------------------------------------

func TestGenerateKey_JobIsolation(t *testing.T) {
	s := &S3Client{}

	key1 := s.GenerateKey("tenant-a", "job-1", "file.log")
	key2 := s.GenerateKey("tenant-a", "job-2", "file.log")
	assert.NotEqual(t, key1, key2, "different jobs should produce different keys")
}

// ---------------------------------------------------------------------------
// Bucket getter
// ---------------------------------------------------------------------------

func TestBucket(t *testing.T) {
	tests := []struct {
		name     string
		bucket   string
		expected string
	}{
		{
			name:     "standard bucket name",
			bucket:   "remedyiq-logs",
			expected: "remedyiq-logs",
		},
		{
			name:     "test bucket name",
			bucket:   "remedyiq-test",
			expected: "remedyiq-test",
		},
		{
			name:     "empty bucket name",
			bucket:   "",
			expected: "",
		},
		{
			name:     "bucket with dots",
			bucket:   "my.bucket.name",
			expected: "my.bucket.name",
		},
		{
			name:     "bucket with hyphens",
			bucket:   "my-bucket-name",
			expected: "my-bucket-name",
		},
		{
			name:     "long bucket name",
			bucket:   "a-very-long-bucket-name-that-is-still-valid",
			expected: "a-very-long-bucket-name-that-is-still-valid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &S3Client{bucket: tt.bucket}
			assert.Equal(t, tt.expected, s.Bucket())
		})
	}
}

// ---------------------------------------------------------------------------
// Bucket immutability (getter always returns configured value)
// ---------------------------------------------------------------------------

func TestBucket_Immutable(t *testing.T) {
	s := &S3Client{bucket: "my-bucket"}

	// Multiple calls should always return the same value.
	assert.Equal(t, "my-bucket", s.Bucket())
	assert.Equal(t, "my-bucket", s.Bucket())
	assert.Equal(t, "my-bucket", s.Bucket())
}

// ---------------------------------------------------------------------------
// NewS3Client validation: empty bucket
// ---------------------------------------------------------------------------

func TestNewS3Client_EmptyBucketReturnsError(t *testing.T) {
	// NewS3Client validates the bucket is non-empty before connecting.
	// We can test this without any real S3 endpoint.
	_, err := NewS3Client(
		t.Context(),
		"http://localhost:9002",
		"accesskey",
		"secretkey",
		"",    // empty bucket
		false, // useSSL
		true,  // skipBucketVerification
	)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "bucket name is required")
}

// ---------------------------------------------------------------------------
// NewS3Client: valid bucket creates client (skipping verification)
// ---------------------------------------------------------------------------

func TestNewS3Client_ValidBucketCreatesClient(t *testing.T) {
	// With skipBucketVerification=true and a valid bucket name,
	// the client should be created even without a real S3 endpoint.
	client, err := NewS3Client(
		t.Context(),
		"http://localhost:9002",
		"accesskey",
		"secretkey",
		"valid-bucket",
		false, // useSSL
		true,  // skipBucketVerification
	)
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.Equal(t, "valid-bucket", client.Bucket())
}
