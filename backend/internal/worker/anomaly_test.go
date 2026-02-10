package worker

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnomalyDetector_NoData(t *testing.T) {
	d := NewAnomalyDetector(3.0)
	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration", nil)
	assert.Nil(t, result)
}

func TestAnomalyDetector_TooFewPoints(t *testing.T) {
	d := NewAnomalyDetector(3.0)
	points := []DataPoint{
		{Key: "A", Value: 100},
		{Key: "B", Value: 200},
	}
	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration", points)
	assert.Nil(t, result, "need at least 3 data points")
}

func TestAnomalyDetector_NoAnomalies(t *testing.T) {
	d := NewAnomalyDetector(3.0)
	points := []DataPoint{
		{Key: "A", Value: 100},
		{Key: "B", Value: 105},
		{Key: "C", Value: 95},
		{Key: "D", Value: 102},
		{Key: "E", Value: 98},
	}
	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration", points)
	assert.Empty(t, result)
}

func TestAnomalyDetector_DetectsOutlier(t *testing.T) {
	d := NewAnomalyDetector(3.0)
	// Need enough normal points so the outlier doesn't distort the statistics
	// too much (Z-score based detection requires the outlier to not dominate
	// the mean/stddev computation).
	points := []DataPoint{
		{Key: "op1", Value: 100},
		{Key: "op2", Value: 105},
		{Key: "op3", Value: 95},
		{Key: "op4", Value: 102},
		{Key: "op5", Value: 98},
		{Key: "op6", Value: 101},
		{Key: "op7", Value: 103},
		{Key: "op8", Value: 97},
		{Key: "op9", Value: 99},
		{Key: "op10", Value: 100},
		{Key: "op11", Value: 104},
		{Key: "op12", Value: 96},
		{Key: "op13", Value: 101},
		{Key: "op14", Value: 98},
		{Key: "op15", Value: 103},
		{Key: "op16", Value: 97},
		{Key: "op17", Value: 102},
		{Key: "op18", Value: 99},
		{Key: "op19", Value: 100},
		{Key: "OUTLIER", Value: 10000},
	}

	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration_ms", points)
	require.NotEmpty(t, result)

	found := false
	for _, a := range result {
		if a.Title == "Anomalous duration_ms: OUTLIER" {
			found = true
			assert.Equal(t, AnomalySlowAPI, a.Type)
			assert.Equal(t, float64(10000), a.Value)
			assert.True(t, a.Sigma >= 3.0)
		}
	}
	assert.True(t, found, "should detect the outlier")
}

func TestAnomalyDetector_AllSameValues(t *testing.T) {
	d := NewAnomalyDetector(3.0)
	points := []DataPoint{
		{Key: "A", Value: 100},
		{Key: "B", Value: 100},
		{Key: "C", Value: 100},
	}
	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration", points)
	assert.Empty(t, result, "all same values means stddev=0, no anomalies")
}

func TestAnomalyDetector_CustomThreshold(t *testing.T) {
	d := NewAnomalyDetector(2.0) // More sensitive
	points := []DataPoint{
		{Key: "op1", Value: 100},
		{Key: "op2", Value: 105},
		{Key: "op3", Value: 95},
		{Key: "op4", Value: 102},
		{Key: "op5", Value: 98},
		{Key: "op6", Value: 500}, // Outlier that exceeds 2-sigma
	}
	result := d.Detect(context.Background(), "job-1", "tenant-1", AnomalySlowAPI, "duration", points)
	assert.NotEmpty(t, result, "with lower threshold, outlier should be detected")
}

func TestMeanStdDev(t *testing.T) {
	mean, stddev := meanStdDev([]float64{2, 4, 4, 4, 5, 5, 7, 9})
	assert.InDelta(t, 5.0, mean, 0.01)
	// Sample standard deviation (n-1 denominator) for this dataset is ~2.138
	assert.InDelta(t, 2.138, stddev, 0.01)
}

func TestMeanStdDev_Empty(t *testing.T) {
	mean, stddev := meanStdDev(nil)
	assert.Equal(t, 0.0, mean)
	assert.Equal(t, 0.0, stddev)
}

func TestMeanStdDev_Single(t *testing.T) {
	mean, stddev := meanStdDev([]float64{42})
	assert.Equal(t, 42.0, mean)
	assert.Equal(t, 0.0, stddev, "single value has stddev 0")
}

func TestClassifySeverity(t *testing.T) {
	assert.Equal(t, "low", classifySeverity(3.0))
	assert.Equal(t, "low", classifySeverity(3.4))
	assert.Equal(t, "medium", classifySeverity(3.5))
	assert.Equal(t, "high", classifySeverity(4.0))
	assert.Equal(t, "critical", classifySeverity(5.0))
	assert.Equal(t, "critical", classifySeverity(10.0))
}

func TestAnomalyDetector_DefaultThreshold(t *testing.T) {
	d := NewAnomalyDetector(0) // Should default to 3.0
	assert.Equal(t, 3.0, d.threshold)
}
