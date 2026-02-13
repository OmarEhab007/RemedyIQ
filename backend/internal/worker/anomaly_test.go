package worker

import (
	"context"
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// meanStdDev tests (table-driven)
// ---------------------------------------------------------------------------

func TestMeanStdDev_TableDriven(t *testing.T) {
	tests := []struct {
		name       string
		values     []float64
		wantMean   float64
		wantStdDev float64
		delta      float64
	}{
		{
			name:       "nil input",
			values:     nil,
			wantMean:   0,
			wantStdDev: 0,
			delta:      0,
		},
		{
			name:       "empty slice",
			values:     []float64{},
			wantMean:   0,
			wantStdDev: 0,
			delta:      0,
		},
		{
			name:       "single value",
			values:     []float64{42},
			wantMean:   42,
			wantStdDev: 0,
			delta:      0,
		},
		{
			name:       "two identical values",
			values:     []float64{5, 5},
			wantMean:   5,
			wantStdDev: 0,
			delta:      0,
		},
		{
			name:       "two different values",
			values:     []float64{2, 8},
			wantMean:   5,
			wantStdDev: math.Sqrt(18), // sample stddev with n-1 = sqrt((9+9)/1)
			delta:      0.001,
		},
		{
			name:       "classic dataset",
			values:     []float64{2, 4, 4, 4, 5, 5, 7, 9},
			wantMean:   5.0,
			wantStdDev: 2.138, // sample standard deviation
			delta:      0.01,
		},
		{
			name:       "all identical values",
			values:     []float64{100, 100, 100, 100, 100},
			wantMean:   100,
			wantStdDev: 0,
			delta:      0,
		},
		{
			name:       "negative values",
			values:     []float64{-10, -20, -30},
			wantMean:   -20,
			wantStdDev: 10,
			delta:      0.001,
		},
		{
			name:       "mixed positive and negative",
			values:     []float64{-5, 0, 5},
			wantMean:   0,
			wantStdDev: 5,
			delta:      0.001,
		},
		{
			name:       "large values",
			values:     []float64{1e9, 1e9 + 1, 1e9 - 1},
			wantMean:   1e9,
			wantStdDev: 1.0,
			delta:      0.001,
		},
		{
			name:       "very small values",
			values:     []float64{0.001, 0.002, 0.003},
			wantMean:   0.002,
			wantStdDev: 0.001,
			delta:      0.0001,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotMean, gotStdDev := meanStdDev(tt.values)
			if tt.delta == 0 {
				assert.Equal(t, tt.wantMean, gotMean, "mean mismatch")
				assert.Equal(t, tt.wantStdDev, gotStdDev, "stddev mismatch")
			} else {
				assert.InDelta(t, tt.wantMean, gotMean, tt.delta, "mean mismatch")
				assert.InDelta(t, tt.wantStdDev, gotStdDev, tt.delta, "stddev mismatch")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// classifySeverity tests (table-driven)
// ---------------------------------------------------------------------------

func TestClassifySeverity_TableDriven(t *testing.T) {
	tests := []struct {
		name     string
		sigma    float64
		expected string
	}{
		// Low severity: sigma < 3.5
		{name: "sigma 0.0 is low", sigma: 0.0, expected: "low"},
		{name: "sigma 1.0 is low", sigma: 1.0, expected: "low"},
		{name: "sigma 2.0 is low", sigma: 2.0, expected: "low"},
		{name: "sigma 3.0 is low", sigma: 3.0, expected: "low"},
		{name: "sigma 3.4 is low", sigma: 3.4, expected: "low"},
		{name: "sigma 3.49 is low", sigma: 3.49, expected: "low"},

		// Medium severity: 3.5 <= sigma < 4.0
		{name: "sigma 3.5 is medium (boundary)", sigma: 3.5, expected: "medium"},
		{name: "sigma 3.7 is medium", sigma: 3.7, expected: "medium"},
		{name: "sigma 3.99 is medium", sigma: 3.99, expected: "medium"},

		// High severity: 4.0 <= sigma < 5.0
		{name: "sigma 4.0 is high (boundary)", sigma: 4.0, expected: "high"},
		{name: "sigma 4.5 is high", sigma: 4.5, expected: "high"},
		{name: "sigma 4.99 is high", sigma: 4.99, expected: "high"},

		// Critical severity: sigma >= 5.0
		{name: "sigma 5.0 is critical (boundary)", sigma: 5.0, expected: "critical"},
		{name: "sigma 6.0 is critical", sigma: 6.0, expected: "critical"},
		{name: "sigma 10.0 is critical", sigma: 10.0, expected: "critical"},
		{name: "sigma 100.0 is critical", sigma: 100.0, expected: "critical"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifySeverity(tt.sigma)
			assert.Equal(t, tt.expected, got)
		})
	}
}

// ---------------------------------------------------------------------------
// NewAnomalyDetector tests
// ---------------------------------------------------------------------------

func TestNewAnomalyDetector_TableDriven(t *testing.T) {
	tests := []struct {
		name              string
		threshold         float64
		expectedThreshold float64
	}{
		{name: "positive threshold", threshold: 3.0, expectedThreshold: 3.0},
		{name: "custom threshold", threshold: 2.5, expectedThreshold: 2.5},
		{name: "zero defaults to 3.0", threshold: 0, expectedThreshold: 3.0},
		{name: "negative defaults to 3.0", threshold: -1.0, expectedThreshold: 3.0},
		{name: "very large negative defaults to 3.0", threshold: -100.0, expectedThreshold: 3.0},
		{name: "very small positive", threshold: 0.1, expectedThreshold: 0.1},
		{name: "large threshold", threshold: 10.0, expectedThreshold: 10.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewAnomalyDetector(tt.threshold)
			require.NotNil(t, d)
			assert.Equal(t, tt.expectedThreshold, d.threshold)
			assert.NotNil(t, d.logger)
		})
	}
}

// ---------------------------------------------------------------------------
// Detect tests (table-driven)
// ---------------------------------------------------------------------------

func TestDetect_TableDriven(t *testing.T) {
	tests := []struct {
		name           string
		threshold      float64
		points         []DataPoint
		expectCount    int // -1 means "at least 1"
		expectNil      bool
		checkOutlierAt int // index of point to verify as anomaly (-1 to skip)
	}{
		{
			name:      "nil points returns nil",
			threshold: 3.0,
			points:    nil,
			expectNil: true,
		},
		{
			name:      "empty points returns nil",
			threshold: 3.0,
			points:    []DataPoint{},
			expectNil: true,
		},
		{
			name:      "1 point returns nil (less than 3)",
			threshold: 3.0,
			points: []DataPoint{
				{Key: "A", Value: 100},
			},
			expectNil: true,
		},
		{
			name:      "2 points returns nil (less than 3)",
			threshold: 3.0,
			points: []DataPoint{
				{Key: "A", Value: 100},
				{Key: "B", Value: 200},
			},
			expectNil: true,
		},
		{
			name:      "3 identical values returns nil (zero stddev)",
			threshold: 3.0,
			points: []DataPoint{
				{Key: "A", Value: 100},
				{Key: "B", Value: 100},
				{Key: "C", Value: 100},
			},
			expectNil: true,
		},
		{
			name:      "normal data with no outliers returns empty",
			threshold: 3.0,
			points: []DataPoint{
				{Key: "A", Value: 100},
				{Key: "B", Value: 105},
				{Key: "C", Value: 95},
				{Key: "D", Value: 102},
				{Key: "E", Value: 98},
			},
			expectCount: 0,
		},
		{
			name:      "data with extreme outlier detects anomaly",
			threshold: 3.0,
			points: func() []DataPoint {
				// 19 tightly clustered points + 1 extreme outlier
				pts := make([]DataPoint, 20)
				for i := 0; i < 19; i++ {
					pts[i] = DataPoint{Key: "normal", Value: 100 + float64(i%5)}
				}
				pts[19] = DataPoint{Key: "OUTLIER", Value: 10000}
				return pts
			}(),
			expectCount: -1, // at least 1
		},
		{
			name:      "lower threshold detects more anomalies",
			threshold: 2.0,
			points: []DataPoint{
				{Key: "A", Value: 100},
				{Key: "B", Value: 105},
				{Key: "C", Value: 95},
				{Key: "D", Value: 102},
				{Key: "E", Value: 98},
				{Key: "F", Value: 500}, // outlier at 2-sigma
			},
			expectCount: -1, // at least 1
		},
		{
			name:      "exactly 3 points with outlier and zero stddev scenario",
			threshold: 3.0,
			points: []DataPoint{
				{Key: "A", Value: 50},
				{Key: "B", Value: 50},
				{Key: "C", Value: 50},
			},
			expectNil: true, // stddev is 0
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := NewAnomalyDetector(tt.threshold)
			result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "test_metric", tt.points)

			if tt.expectNil {
				assert.Nil(t, result)
				return
			}

			if tt.expectCount == -1 {
				assert.NotEmpty(t, result, "expected at least one anomaly")
			} else {
				assert.Len(t, result, tt.expectCount)
			}

			// Verify all detected anomalies have proper fields
			for _, a := range result {
				assert.NotEmpty(t, a.ID, "anomaly ID should be set")
				assert.Equal(t, "job-1", a.JobID)
				assert.Equal(t, "tenant-1", a.TenantID)
				assert.Equal(t, AnomalySlowAPI, a.Type)
				assert.Equal(t, "test_metric", a.Metric)
				assert.NotEmpty(t, a.Title)
				assert.NotEmpty(t, a.Description)
				assert.NotEmpty(t, a.Severity)
				assert.True(t, a.Sigma >= tt.threshold, "sigma should be >= threshold")
				assert.NotZero(t, a.DetectedAt, "detected_at should be set")
				assert.Contains(t, []string{"low", "medium", "high", "critical"}, a.Severity)
			}
		})
	}
}

// TestDetect_AnomalyFieldsContent verifies the exact content of anomaly fields
// beyond just checking they are non-empty.
func TestDetect_AnomalyFieldsContent(t *testing.T) {
	d := NewAnomalyDetector(2.0)

	// Build points: 19 clustered at 100 + 1 extreme outlier at 10000
	pts := make([]DataPoint, 20)
	for i := 0; i < 19; i++ {
		pts[i] = DataPoint{
			Key:      "normal",
			Value:    100,
			Metadata: map[string]string{"rank": "1"},
		}
	}
	pts[19] = DataPoint{
		Key:      "slow_endpoint",
		Value:    10000,
		Metadata: map[string]string{"form": "HPD"},
	}

	anomalies := d.Detect(context.Background(), "job-42", "tenant-99", AnomalySlowSQL, "sql_duration_ms", pts)
	require.NotEmpty(t, anomalies)

	// Find the outlier anomaly
	var outlier *Anomaly
	for i := range anomalies {
		if anomalies[i].Value == 10000 {
			outlier = &anomalies[i]
			break
		}
	}
	require.NotNil(t, outlier, "should find the 10000 value outlier")

	assert.Equal(t, "job-42", outlier.JobID)
	assert.Equal(t, "tenant-99", outlier.TenantID)
	assert.Equal(t, AnomalySlowSQL, outlier.Type)
	assert.Equal(t, "sql_duration_ms", outlier.Metric)
	assert.Equal(t, float64(10000), outlier.Value)
	assert.Contains(t, outlier.Title, "sql_duration_ms")
	assert.Contains(t, outlier.Title, "slow_endpoint")
	assert.Contains(t, outlier.Description, "slow_endpoint")
	assert.Greater(t, outlier.Sigma, 2.0)
	assert.Greater(t, outlier.StdDev, 0.0)

	// Baseline is the mean of all 20 points
	expectedMean := (19*100.0 + 10000.0) / 20.0
	assert.InDelta(t, expectedMean, outlier.Baseline, 0.01)
}

// TestDetect_AllAnomalyTypes verifies that the detector correctly assigns
// whatever anomaly type is passed in.
func TestDetect_AllAnomalyTypes(t *testing.T) {
	types := []AnomalyType{
		AnomalySlowAPI,
		AnomalySlowSQL,
		AnomalyHighErrorRate,
		AnomalySlowFilter,
		AnomalySlowEsc,
	}

	// Build data with one obvious outlier
	pts := make([]DataPoint, 20)
	for i := 0; i < 19; i++ {
		pts[i] = DataPoint{Key: "normal", Value: 100}
	}
	pts[19] = DataPoint{Key: "outlier", Value: 10000}

	for _, anomalyType := range types {
		t.Run(string(anomalyType), func(t *testing.T) {
			d := NewAnomalyDetector(2.0)
			result := d.Detect(context.Background(), "job-1", "tenant-1", anomalyType, "metric", pts)
			require.NotEmpty(t, result)
			for _, a := range result {
				assert.Equal(t, anomalyType, a.Type)
			}
		})
	}
}

// TestDetect_ContextIrrelevant verifies the detector does not check the
// context (the current implementation is purely computational).
func TestDetect_CancelledContextStillWorks(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	d := NewAnomalyDetector(2.0)
	pts := make([]DataPoint, 20)
	for i := 0; i < 19; i++ {
		pts[i] = DataPoint{Key: "normal", Value: 100}
	}
	pts[19] = DataPoint{Key: "outlier", Value: 10000}

	result := d.Detect(ctx, "job-1", "tenant-1", AnomalySlowAPI, "duration", pts)
	assert.NotEmpty(t, result, "cancelled context should not prevent detection")
}
