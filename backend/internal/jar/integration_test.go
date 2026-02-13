package jar

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

// TestIntegration_JARToParser runs the actual JAR binary on a real log file
// and verifies the parser extracts meaningful data from the output.
//
// This test is skipped if:
// - JAR binary is not found at expected path
// - Java runtime is not available
// - No test log files are available
// - Running in CI (set CI=true to skip)
func TestIntegration_JARToParser(t *testing.T) {
	if os.Getenv("CI") == "true" {
		t.Skip("skipping integration test in CI")
	}

	// Find project root (5 levels up from internal/jar/).
	_, thisFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")

	jarPath := filepath.Join(projectRoot, "ARLogAnalyzer", "ARLogAnalyzer-3", "ARLogAnalyzer.jar")
	if _, err := os.Stat(jarPath); os.IsNotExist(err) {
		t.Skipf("JAR not found at %s", jarPath)
	}

	// Check for java.
	javaPath, err := exec.LookPath("java")
	if err != nil {
		t.Skip("java not found in PATH")
	}
	_ = javaPath

	// Find a test log file.
	logDir := filepath.Join(projectRoot, "error_logs")
	logFile := filepath.Join(logDir, "log1.log")
	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		t.Skipf("test log file not found at %s", logFile)
	}

	// Snappy native lib for macOS ARM — must point to directory containing libsnappyjava.dylib.
	snappyLibDir := filepath.Join(projectRoot, "backend", "lib", "snappy-native",
		"org", "xerial", "snappy", "native", "Mac", "aarch64")

	// Run JAR.
	ctx := context.Background()
	args := []string{
		"-Xmx2g",
		"-Dorg.xerial.snappy.lib.path=" + snappyLibDir,
		"-Dorg.xerial.snappy.lib.name=libsnappyjava.dylib",
		"-jar", jarPath,
		logFile,
	}

	cmd := exec.CommandContext(ctx, "java", args...)
	output, err := cmd.Output()
	if err != nil {
		// Try to get stderr for diagnostics.
		if exitErr, ok := err.(*exec.ExitError); ok {
			t.Fatalf("JAR failed: %v\nstderr: %s", err, string(exitErr.Stderr))
		}
		t.Fatalf("JAR failed: %v", err)
	}

	stdout := string(output)
	if len(stdout) < 100 {
		t.Fatalf("JAR output too short (%d bytes), expected substantial output", len(stdout))
	}

	t.Logf("JAR output: %d bytes", len(stdout))

	// Parse the output.
	result, err := ParseOutput(stdout)
	if err != nil {
		t.Fatalf("ParseOutput failed: %v", err)
	}

	dashboard := result.Dashboard

	// Verify general statistics were extracted.
	t.Logf("GeneralStats: TotalLines=%d, API=%d, SQL=%d, ESC=%d, Filter=%d",
		dashboard.GeneralStats.TotalLines,
		dashboard.GeneralStats.APICount,
		dashboard.GeneralStats.SQLCount,
		dashboard.GeneralStats.EscCount,
		dashboard.GeneralStats.FilterCount,
	)
	t.Logf("GeneralStats: UniqueUsers=%d, UniqueForms=%d, UniqueTables=%d",
		dashboard.GeneralStats.UniqueUsers,
		dashboard.GeneralStats.UniqueForms,
		dashboard.GeneralStats.UniqueTables,
	)
	t.Logf("GeneralStats: LogStart=%v, LogEnd=%v, Duration=%s",
		dashboard.GeneralStats.LogStart,
		dashboard.GeneralStats.LogEnd,
		dashboard.GeneralStats.LogDuration,
	)

	if dashboard.GeneralStats.TotalLines == 0 {
		t.Error("TotalLines should not be 0")
	}
	if dashboard.GeneralStats.APICount == 0 {
		t.Error("APICount should not be 0")
	}
	if dashboard.GeneralStats.SQLCount == 0 {
		t.Error("SQLCount should not be 0")
	}
	if dashboard.GeneralStats.LogDuration == "" {
		t.Error("LogDuration should not be empty")
	}

	// Verify top-N sections.
	t.Logf("TopAPICalls: %d entries", len(dashboard.TopAPICalls))
	if len(dashboard.TopAPICalls) == 0 {
		t.Error("TopAPICalls should not be empty")
	} else {
		first := dashboard.TopAPICalls[0]
		t.Logf("  First API: Rank=%d, Duration=%dms, ID=%q, Form=%q, TraceID=%q",
			first.Rank, first.DurationMS, first.Identifier, first.Form, first.TraceID)
		if first.Rank != 1 {
			t.Errorf("First API entry rank should be 1, got %d", first.Rank)
		}
		if first.DurationMS == 0 {
			t.Error("First API entry DurationMS should not be 0")
		}
		if first.Identifier == "" {
			t.Error("First API entry Identifier should not be empty")
		}
	}

	t.Logf("TopSQL: %d entries", len(dashboard.TopSQL))
	if len(dashboard.TopSQL) == 0 {
		t.Error("TopSQL should not be empty")
	} else {
		first := dashboard.TopSQL[0]
		t.Logf("  First SQL: Rank=%d, Duration=%dms, ID=%q, Table=%q",
			first.Rank, first.DurationMS, first.Identifier, first.Form)
		if first.Rank != 1 {
			t.Errorf("First SQL entry rank should be 1, got %d", first.Rank)
		}
		if first.DurationMS == 0 {
			t.Error("First SQL entry DurationMS should not be 0")
		}
	}

	t.Logf("TopFilters: %d entries", len(dashboard.TopFilters))
	if len(dashboard.TopFilters) > 0 {
		first := dashboard.TopFilters[0]
		t.Logf("  First Filter: Rank=%d, Duration=%dms, ID=%q, Form=%q, Queue=%q",
			first.Rank, first.DurationMS, first.Identifier, first.Form, first.Queue)
		if first.Identifier == "" {
			t.Error("First Filter entry Identifier should not be empty")
		}
	}

	t.Logf("TopEscalations: %d entries", len(dashboard.TopEscalations))
	if len(dashboard.TopEscalations) > 0 {
		first := dashboard.TopEscalations[0]
		t.Logf("  First Escalation: Rank=%d, Duration=%dms, ID=%q, Form=%q, Queue=%q",
			first.Rank, first.DurationMS, first.Identifier, first.Form, first.Queue)
		if first.Identifier == "" {
			t.Error("First Escalation entry Identifier should not be empty")
		}
	}

	// Verify at least some sections have data.
	sectionsWithData := 0
	if len(dashboard.TopAPICalls) > 0 {
		sectionsWithData++
	}
	if len(dashboard.TopSQL) > 0 {
		sectionsWithData++
	}
	if len(dashboard.TopFilters) > 0 {
		sectionsWithData++
	}
	if len(dashboard.TopEscalations) > 0 {
		sectionsWithData++
	}
	if sectionsWithData < 2 {
		t.Errorf("Expected at least 2 top-N sections with data, got %d", sectionsWithData)
	}
}
