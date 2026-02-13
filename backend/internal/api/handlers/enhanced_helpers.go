package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/storage"
	"github.com/OmarEhab007/RemedyIQ/backend/internal/worker"
)

const sectionCacheTTL = 24 * time.Hour

func getOrComputeAggregates(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.AggregatesResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":agg"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
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

func getOrComputeExceptions(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.ExceptionsResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":exc"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
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

func getOrComputeGaps(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.GapsResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":gaps"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
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

func getOrComputeThreads(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.ThreadStatsResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":threads"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
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

func getOrComputeFilters(ctx context.Context, redis storage.RedisCache, tenantID, jobID string) (*domain.FilterComplexityResponse, error) {
	cacheKey := redis.TenantKey(tenantID, "dashboard", jobID) + ":filters"
	cached, err := redis.Get(ctx, cacheKey)
	if err == nil && cached != "" {
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
