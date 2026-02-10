package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps the go-redis client and provides tenant-aware caching
// and rate limiting operations.
type RedisClient struct {
	client *redis.Client
}

// NewRedisClient creates a new Redis client from the given URL.
// The URL format follows the redis:// convention, e.g.
// "redis://localhost:6379" or "redis://:password@host:6379/0".
func NewRedisClient(ctx context.Context, url string) (*RedisClient, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("redis: parse url: %w", err)
	}

	client := redis.NewClient(opts)

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis: ping: %w", err)
	}

	return &RedisClient{client: client}, nil
}

// Close releases the underlying Redis connection.
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// Ping verifies connectivity to Redis.
func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// Get retrieves a string value by key. Returns redis.Nil error if the key
// does not exist; callers should check with errors.Is(err, redis.Nil).
func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		return "", err
	}
	return val, nil
}

// Set stores a value in Redis with the given TTL. The value is JSON-encoded
// if it is not already a string or []byte.
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	var data interface{}
	switch v := value.(type) {
	case string:
		data = v
	case []byte:
		data = v
	default:
		encoded, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("redis: marshal value: %w", err)
		}
		data = encoded
	}

	if err := r.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis: set %q: %w", key, err)
	}
	return nil
}

// Delete removes a key from Redis.
func (r *RedisClient) Delete(ctx context.Context, key string) error {
	if err := r.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("redis: delete %q: %w", key, err)
	}
	return nil
}

// TenantKey builds a tenant-prefixed Redis key.
// Format: "remedyiq:{tenantID}:{category}:{id}"
func (r *RedisClient) TenantKey(tenantID, category, id string) string {
	parts := []string{"remedyiq", tenantID, category}
	if id != "" {
		parts = append(parts, id)
	}
	return strings.Join(parts, ":")
}

// CheckRateLimit implements a sliding window rate limiter using a Redis
// sorted set. It returns true if the request is allowed (under the limit)
// and false if the rate limit has been exceeded.
//
// The algorithm:
//  1. Remove all entries older than the window.
//  2. Count the remaining entries.
//  3. If count < limit, add the current timestamp and allow.
//  4. Otherwise, deny.
//
// All operations run inside a Redis pipeline for atomicity.
func (r *RedisClient) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	now := time.Now()
	windowStart := now.Add(-window)

	// Use a Lua script for atomicity.
	script := redis.NewScript(`
		local key = KEYS[1]
		local window_start = tonumber(ARGV[1])
		local now = tonumber(ARGV[2])
		local limit = tonumber(ARGV[3])
		local ttl = tonumber(ARGV[4])

		-- Remove expired entries
		redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

		-- Count remaining
		local count = redis.call('ZCARD', key)

		if count < limit then
			-- Add current request
			redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
			-- Set expiry on the key to auto-clean
			redis.call('PEXPIRE', key, ttl)
			return 1
		else
			-- Set expiry even on denied requests to ensure cleanup
			redis.call('PEXPIRE', key, ttl)
			return 0
		end
	`)

	result, err := script.Run(ctx, r.client, []string{key},
		float64(windowStart.UnixMilli()),
		float64(now.UnixMilli()),
		limit,
		window.Milliseconds(),
	).Int()
	if err != nil {
		return false, fmt.Errorf("redis: rate limit check: %w", err)
	}

	return result == 1, nil
}
