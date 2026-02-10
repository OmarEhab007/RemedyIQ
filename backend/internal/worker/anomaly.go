package worker

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
)

// AnomalyType identifies the category of anomaly.
type AnomalyType string

const (
	AnomalySlowAPI       AnomalyType = "slow_api"
	AnomalySlowSQL       AnomalyType = "slow_sql"
	AnomalyHighErrorRate AnomalyType = "high_error_rate"
	AnomalySlowFilter    AnomalyType = "slow_filter"
	AnomalySlowEsc       AnomalyType = "slow_escalation"
)

// Anomaly represents a detected performance anomaly.
type Anomaly struct {
	ID          string      `json:"id"`
	JobID       string      `json:"job_id"`
	TenantID    string      `json:"tenant_id"`
	Type        AnomalyType `json:"type"`
	Severity    string      `json:"severity"` // "low", "medium", "high", "critical"
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Metric      string      `json:"metric"`
	Value       float64     `json:"value"`
	Baseline    float64     `json:"baseline"`
	StdDev      float64     `json:"std_dev"`
	Sigma       float64     `json:"sigma"` // how many standard deviations from mean
	DetectedAt  time.Time   `json:"detected_at"`
}

// DataPoint represents a single observation for anomaly detection.
type DataPoint struct {
	Key      string
	Value    float64
	Metadata map[string]string
}

// AnomalyDetector finds statistical anomalies in analysis results.
type AnomalyDetector struct {
	threshold float64 // sigma threshold (default 3.0)
	logger    *slog.Logger
}

// NewAnomalyDetector creates a detector with the given sigma threshold.
func NewAnomalyDetector(threshold float64) *AnomalyDetector {
	if threshold <= 0 {
		threshold = 3.0
	}
	return &AnomalyDetector{
		threshold: threshold,
		logger:    slog.Default().With("component", "anomaly"),
	}
}

// Detect analyzes data points and returns anomalies that exceed the sigma threshold.
func (d *AnomalyDetector) Detect(ctx context.Context, jobID, tenantID string, anomalyType AnomalyType, metric string, points []DataPoint) []Anomaly {
	if len(points) < 3 {
		return nil
	}

	values := make([]float64, len(points))
	for i, p := range points {
		values[i] = p.Value
	}

	mean, stddev := meanStdDev(values)

	if stddev == 0 {
		return nil
	}

	var anomalies []Anomaly
	for _, p := range points {
		sigma := math.Abs(p.Value-mean) / stddev
		if sigma >= d.threshold {
			severity := classifySeverity(sigma)
			anomaly := Anomaly{
				ID:          uuid.New().String(),
				JobID:       jobID,
				TenantID:    tenantID,
				Type:        anomalyType,
				Severity:    severity,
				Title:       fmt.Sprintf("Anomalous %s: %s", metric, p.Key),
				Description: fmt.Sprintf("%s for %s is %.1f (baseline: %.1f, %.1f\u03c3 deviation)", metric, p.Key, p.Value, mean, sigma),
				Metric:      metric,
				Value:       p.Value,
				Baseline:    mean,
				StdDev:      stddev,
				Sigma:       sigma,
				DetectedAt:  time.Now().UTC(),
			}
			anomalies = append(anomalies, anomaly)
		}
	}

	if len(anomalies) > 0 {
		d.logger.Info("anomalies detected",
			"job_id", jobID,
			"type", anomalyType,
			"count", len(anomalies),
		)
	}

	return anomalies
}

// meanStdDev computes the mean and sample standard deviation.
func meanStdDev(values []float64) (float64, float64) {
	n := float64(len(values))
	if n == 0 {
		return 0, 0
	}

	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / n

	var sqDiff float64
	for _, v := range values {
		d := v - mean
		sqDiff += d * d
	}

	if n <= 1 {
		return mean, 0
	}

	stddev := math.Sqrt(sqDiff / (n - 1))
	return mean, stddev
}

// classifySeverity maps sigma deviation to severity level.
func classifySeverity(sigma float64) string {
	switch {
	case sigma >= 5:
		return "critical"
	case sigma >= 4:
		return "high"
	case sigma >= 3.5:
		return "medium"
	default:
		return "low"
	}
}
