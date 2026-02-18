package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/worker"
)

const sectionCacheTTL = 24 * time.Hour

// isJARParsedCache checks if a cached JSON string contains the jar_parsed source marker.
func isJARParsedCache(cached string) bool {
	return strings.Contains(cached, `"source":"jar_parsed"`)
}

func getOrComputeAggregates(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (any, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":agg"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		// Try JAR-native type first.
		if isJARParsedCache(cached) {
			var jarData domain.JARAggregatesResponse
			if err := json.Unmarshal([]byte(cached), &jarData); err == nil {
				return &jarData, nil
			}
		}
		// Fall back to computed type.
		var data domain.AggregatesResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	dashboard, err := getDashboardFromCache(ctx, redis, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	result := worker.ComputeEnhancedSections(dashboard)
	if result.Aggregates == nil {
		return &domain.AggregatesResponse{}, nil
	}

	_ = redis.Set(ctx, cacheKey, result.Aggregates, sectionCacheTTL)
	return result.Aggregates, nil
}

func getOrComputeExceptions(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (any, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":exc"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		if isJARParsedCache(cached) {
			var jarData domain.JARExceptionsResponse
			if err := json.Unmarshal([]byte(cached), &jarData); err == nil {
				return &jarData, nil
			}
		}
		var data domain.ExceptionsResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	dashboard, err := getDashboardFromCache(ctx, redis, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	result := worker.ComputeEnhancedSections(dashboard)
	if result.Exceptions == nil {
		return &domain.ExceptionsResponse{
			Exceptions: []domain.ExceptionEntry{},
			ErrorRates: make(map[string]float64),
			TopCodes:   []string{},
		}, nil
	}

	_ = redis.Set(ctx, cacheKey, result.Exceptions, sectionCacheTTL)
	return result.Exceptions, nil
}

func getOrComputeGaps(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (any, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":gaps"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		if isJARParsedCache(cached) {
			var jarData domain.JARGapsResponse
			if err := json.Unmarshal([]byte(cached), &jarData); err == nil {
				return &jarData, nil
			}
		}
		var data domain.GapsResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	dashboard, err := getDashboardFromCache(ctx, redis, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	result := worker.ComputeEnhancedSections(dashboard)
	if result.Gaps == nil {
		return &domain.GapsResponse{
			Gaps:        []domain.GapEntry{},
			QueueHealth: []domain.QueueHealthSummary{},
		}, nil
	}

	_ = redis.Set(ctx, cacheKey, result.Gaps, sectionCacheTTL)
	return result.Gaps, nil
}

func getOrComputeThreads(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (any, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":threads"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		if isJARParsedCache(cached) {
			var jarData domain.JARThreadStatsResponse
			if err := json.Unmarshal([]byte(cached), &jarData); err == nil {
				return &jarData, nil
			}
		}
		var data domain.ThreadStatsResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	dashboard, err := getDashboardFromCache(ctx, redis, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	result := worker.ComputeEnhancedSections(dashboard)
	if result.ThreadStats == nil {
		return &domain.ThreadStatsResponse{
			Threads: []domain.ThreadStatsEntry{},
		}, nil
	}

	_ = redis.Set(ctx, cacheKey, result.ThreadStats, sectionCacheTTL)
	return result.ThreadStats, nil
}

func getOrComputeFilters(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (any, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":filters"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		if isJARParsedCache(cached) {
			var jarData domain.JARFilterComplexityResponse
			if err := json.Unmarshal([]byte(cached), &jarData); err == nil {
				return &jarData, nil
			}
		}
		var data domain.FilterComplexityResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	dashboard, err := getDashboardFromCache(ctx, redis, tenantID, jobID)
	if err != nil {
		return nil, err
	}

	result := worker.ComputeEnhancedSections(dashboard)
	if result.Filters == nil {
		return &domain.FilterComplexityResponse{
			MostExecuted:   []domain.MostExecutedFilter{},
			PerTransaction: []domain.FilterPerTransaction{},
		}, nil
	}

	_ = redis.Set(ctx, cacheKey, result.Filters, sectionCacheTTL)
	return result.Filters, nil
}

func getOrComputeQueuedCalls(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.QueuedCallsResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":queued"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		var data domain.QueuedCallsResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	// No computed fallback — queued calls data only comes from JAR output.
	return &domain.QueuedCallsResponse{
		JobID:          jobID,
		QueuedAPICalls: []domain.TopNEntry{},
		Total:          0,
	}, nil
}

func getOrComputeLoggingActivity(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.LoggingActivityResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":logging-activity"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		var data domain.LoggingActivityResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	// No computed fallback — logging activity data only comes from JAR output.
	return &domain.LoggingActivityResponse{
		JobID:      jobID,
		Activities: []domain.LoggingActivity{},
	}, nil
}

func getOrComputeFileMetadata(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.FileMetadataResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":file-metadata"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
		var data domain.FileMetadataResponse
		if err := json.Unmarshal([]byte(cached), &data); err == nil {
			return &data, nil
		}
	}

	// No computed fallback — file metadata only comes from JAR output.
	return &domain.FileMetadataResponse{
		JobID: jobID,
		Files: []domain.FileMetadata{},
		Total: 0,
	}, nil
}

func getDashboardFromCache(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.DashboardData, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID)
	cached, err := redis.Get(ctx, cacheKey)
	if err != nil || cached == "" {
		slog.Error("dashboard data not found in cache", "job_id", jobID, "error", err)
		return nil, err
	}

	var dashboard domain.DashboardData
	if err := json.Unmarshal([]byte(cached), &dashboard); err != nil {
		slog.Error("failed to unmarshal dashboard data", "job_id", jobID, "error", err)
		return nil, err
	}

	return &dashboard, nil
}
