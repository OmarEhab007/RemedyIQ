package storage

import (
	"context"
	"fmt"
	"io"
	"path"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client wraps the AWS S3 SDK client for object storage operations.
// It supports both AWS S3 and MinIO (or any S3-compatible service).
type S3Client struct {
	client *s3.Client
	bucket string
}

// NewS3Client creates a new S3 client configured for the given endpoint.
// For MinIO, set useSSL to false and pass the MinIO endpoint
// (e.g. "http://localhost:9002").
//
// If skipBucketVerification is true, the client will not verify or create the bucket.
// This is useful for development with MinIO where the bucket may already exist
// or the user may not have permission to create buckets.
func NewS3Client(ctx context.Context, endpoint, accessKey, secretKey, bucket string, useSSL, skipBucketVerification bool) (*S3Client, error) {
	if bucket == "" {
		return nil, fmt.Errorf("s3: bucket name is required")
	}

	cfg := aws.Config{
		Region:      "us-east-1",
		Credentials: credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
		if !useSSL {
			o.EndpointOptions.DisableHTTPS = true
		}
	})

	// Verify the bucket exists (or create it for development) unless skipped.
	if !skipBucketVerification {
		_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{
			Bucket: aws.String(bucket),
		})
		if err != nil {
			// Try to create the bucket if it does not exist.
			_, createErr := client.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(bucket),
			})
			if createErr != nil {
				return nil, fmt.Errorf("s3: bucket %q not accessible and could not create: %w (original: %v)", bucket, createErr, err)
			}
		}
	}

	return &S3Client{
		client: client,
		bucket: bucket,
	}, nil
}

// Upload stores an object in S3. The key should be generated via GenerateKey
// to ensure tenant isolation. If size is negative, ContentLength is omitted
// and the SDK will stream the upload without a pre-declared length.
func (s *S3Client) Upload(ctx context.Context, key string, reader io.Reader, size int64) error {
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   reader,
	}

	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}

	_, err := s.client.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("s3: upload %q: %w", key, err)
	}

	return nil
}

// Download returns an io.ReadCloser for the object at the given key.
// The caller is responsible for closing the reader when done.
func (s *S3Client) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("s3: download %q: %w", key, err)
	}

	return output.Body, nil
}

// Delete removes an object from S3.
func (s *S3Client) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("s3: delete %q: %w", key, err)
	}

	return nil
}

// GenerateKey builds a tenant-prefixed S3 object key.
// Format: tenants/{tenantID}/jobs/{jobID}/{filename}
func (s *S3Client) GenerateKey(tenantID, jobID, filename string) string {
	return path.Join("tenants", tenantID, "jobs", jobID, filename)
}

// Bucket returns the configured bucket name.
func (s *S3Client) Bucket() string {
	return s.bucket
}
