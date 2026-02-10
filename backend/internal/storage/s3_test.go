//go:build integration

package storage

import (
	"bytes"
	"context"
	"io"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func s3Config() (endpoint, accessKey, secretKey, bucket string, useSSL bool) {
	endpoint = os.Getenv("S3_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:9002"
	}
	accessKey = os.Getenv("S3_ACCESS_KEY")
	if accessKey == "" {
		accessKey = "minioadmin"
	}
	secretKey = os.Getenv("S3_SECRET_KEY")
	if secretKey == "" {
		secretKey = "minioadmin"
	}
	bucket = os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "remedyiq-test"
	}
	useSSL = false
	return
}

func setupS3(t *testing.T) *S3Client {
	t.Helper()
	ctx := context.Background()
	endpoint, accessKey, secretKey, bucket, useSSL := s3Config()
	client, err := NewS3Client(ctx, endpoint, accessKey, secretKey, bucket, useSSL)
	require.NoError(t, err, "failed to connect to S3/MinIO")
	return client
}

func TestS3_GenerateKey(t *testing.T) {
	client := setupS3(t)

	key := client.GenerateKey("tenant-123", "job-456", "server.log")
	assert.Equal(t, "tenants/tenant-123/jobs/job-456/server.log", key)

	key = client.GenerateKey("t1", "j1", "nested/path/file.txt")
	assert.Equal(t, "tenants/t1/jobs/j1/nested/path/file.txt", key)
}

func TestS3_UploadDownloadDelete(t *testing.T) {
	client := setupS3(t)
	ctx := context.Background()

	tenantID := "test-tenant-s3"
	jobID := "test-job-s3"
	filename := "test-upload.log"
	key := client.GenerateKey(tenantID, jobID, filename)

	content := "This is a test log file content.\nLine 2.\nLine 3."
	contentBytes := []byte(content)

	// Upload
	err := client.Upload(ctx, key, bytes.NewReader(contentBytes), int64(len(contentBytes)))
	require.NoError(t, err, "Upload should succeed")

	// Download
	reader, err := client.Download(ctx, key)
	require.NoError(t, err, "Download should succeed")
	defer reader.Close()

	downloaded, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, content, string(downloaded))

	// Delete
	err = client.Delete(ctx, key)
	require.NoError(t, err, "Delete should succeed")

	// Verify deleted - download should fail.
	_, err = client.Download(ctx, key)
	assert.Error(t, err, "Download after delete should fail")
}

func TestS3_UploadLargeFile(t *testing.T) {
	client := setupS3(t)
	ctx := context.Background()

	key := client.GenerateKey("tenant-large", "job-large", "big-file.bin")

	// Create a 1MB file.
	size := 1024 * 1024
	data := make([]byte, size)
	for i := range data {
		data[i] = byte(i % 256)
	}

	err := client.Upload(ctx, key, bytes.NewReader(data), int64(size))
	require.NoError(t, err)

	reader, err := client.Download(ctx, key)
	require.NoError(t, err)
	defer reader.Close()

	downloaded, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Len(t, downloaded, size)
	assert.Equal(t, data, downloaded)

	// Cleanup
	require.NoError(t, client.Delete(ctx, key))
}

func TestS3_DownloadNonExistent(t *testing.T) {
	client := setupS3(t)
	ctx := context.Background()

	_, err := client.Download(ctx, "nonexistent/path/file.txt")
	assert.Error(t, err)
}

func TestS3_DeleteNonExistent(t *testing.T) {
	client := setupS3(t)
	ctx := context.Background()

	// S3 DeleteObject is idempotent; it should not error on missing keys.
	err := client.Delete(ctx, "nonexistent/path/file.txt")
	assert.NoError(t, err)
}
