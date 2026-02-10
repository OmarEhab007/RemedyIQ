package jar

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/OmarEhab007/RemedyIQ/backend/internal/domain"
)

// Result holds the output of a completed JAR subprocess execution.
type Result struct {
	// Stdout is the full standard output captured from the process.
	Stdout string
	// Stderr is the full standard error captured from the process.
	Stderr string
	// ExitCode is the process exit code (0 = success).
	ExitCode int
	// Duration is the wall-clock time the process ran.
	Duration time.Duration
}

// Runner manages execution of ARLogAnalyzer.jar as a subprocess.
type Runner struct {
	// jarPath is the filesystem path to ARLogAnalyzer.jar.
	jarPath string
	// defaultHeapMB is the default JVM max heap in megabytes.
	defaultHeapMB int
	// defaultTimeoutSec is the default execution timeout in seconds.
	defaultTimeoutSec int
	// javaCmd is the java binary name or path. Defaults to "java".
	// Exposed for testing so callers can substitute a mock command.
	javaCmd string
}

// NewRunner creates a Runner configured with the given JAR path and defaults.
// If defaultHeapMB <= 0, it falls back to 4096 MB.
// If defaultTimeoutSec <= 0, it falls back to 1800 seconds (30 minutes).
func NewRunner(jarPath string, defaultHeapMB int, defaultTimeoutSec int) *Runner {
	if defaultHeapMB <= 0 {
		defaultHeapMB = 4096
	}
	if defaultTimeoutSec <= 0 {
		defaultTimeoutSec = 1800
	}
	return &Runner{
		jarPath:            jarPath,
		defaultHeapMB:      defaultHeapMB,
		defaultTimeoutSec:  defaultTimeoutSec,
		javaCmd:            "java",
	}
}

// SetJavaCmd overrides the java binary used to launch the JAR.
// This is primarily useful for testing, where a mock command like "echo"
// can stand in for the real JVM.
func (r *Runner) SetJavaCmd(cmd string) {
	r.javaCmd = cmd
}

// Run executes ARLogAnalyzer.jar with the given flags and returns the result.
//
// The heapMB parameter controls the -Xmx setting for this specific run.
// If heapMB <= 0, the runner's defaultHeapMB is used.
//
// The provided context controls cancellation. If the context has no deadline,
// Run applies the runner's defaultTimeoutSec as a deadline. When the deadline
// is reached, the subprocess is killed and an error is returned.
//
// The optional lineCallback, if non-nil, is invoked for each line of stdout
// as it is produced, enabling real-time progress tracking.
func (r *Runner) Run(
	ctx context.Context,
	filePath string,
	flags domain.JARFlags,
	heapMB int,
	lineCallback func(line string),
) (*Result, error) {
	if heapMB <= 0 {
		heapMB = r.defaultHeapMB
	}

	// Apply default timeout if the context has no deadline.
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(r.defaultTimeoutSec)*time.Second)
		defer cancel()
	}

	// Build the full command.
	jarArgs := BuildArgs(flags, filePath)
	cmdArgs := r.buildCommandArgs(heapMB, jarArgs)

	cmd := exec.CommandContext(ctx, cmdArgs[0], cmdArgs[1:]...)

	// Capture stderr into a buffer.
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	// Create a pipe for stdout so we can stream lines.
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("jar runner: failed to create stdout pipe: %w", err)
	}

	startTime := time.Now()

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("jar runner: failed to start process: %w", err)
	}

	// Read stdout line-by-line in a goroutine.
	var stdoutBuf bytes.Buffer
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdoutPipe)
		// Allow lines up to 1 MB (JAR can produce very long SQL lines).
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			stdoutBuf.WriteString(line)
			stdoutBuf.WriteByte('\n')
			if lineCallback != nil {
				lineCallback(line)
			}
		}
	}()

	// Wait for the stdout reader to finish before calling cmd.Wait,
	// which closes the pipe.
	wg.Wait()

	// Wait for the process to exit.
	waitErr := cmd.Wait()
	duration := time.Since(startTime)

	result := &Result{
		Stdout:   stdoutBuf.String(),
		Stderr:   stderrBuf.String(),
		Duration: duration,
	}

	// Determine exit code and error classification.
	// Check context errors FIRST, because when exec.CommandContext kills a
	// process due to a deadline or cancellation, the resulting error is an
	// *exec.ExitError with code -1. We must detect the context cause before
	// falling through to generic exit-code handling.
	if waitErr != nil {
		// Extract exit code from the error if available.
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		}

		// Context-driven termination takes priority.
		if ctx.Err() == context.DeadlineExceeded {
			return result, fmt.Errorf("jar runner: process timed out after %s: %w", duration.Truncate(time.Second), ctx.Err())
		}
		if ctx.Err() == context.Canceled {
			return result, fmt.Errorf("jar runner: process cancelled: %w", ctx.Err())
		}

		// Non-zero exit from the JAR itself.
		if result.ExitCode != 0 {
			errMsg := strings.TrimSpace(result.Stderr)
			if errMsg == "" {
				errMsg = fmt.Sprintf("process exited with code %d", result.ExitCode)
			}
			return result, fmt.Errorf("jar runner: non-zero exit code %d: %s", result.ExitCode, errMsg)
		}

		// Some other unexpected error.
		return result, fmt.Errorf("jar runner: process failed: %w", waitErr)
	}

	return result, nil
}

// buildCommandArgs constructs the full argument list for exec.Command.
// When javaCmd is "java", this produces:
//
//	java -Xmx{heap}m -jar {jarPath} {jarArgs...}
//
// When javaCmd is overridden (e.g., for testing with "echo"), the
// arguments are passed directly to that command.
func (r *Runner) buildCommandArgs(heapMB int, jarArgs []string) []string {
	if r.javaCmd == "java" {
		args := []string{
			r.javaCmd,
			fmt.Sprintf("-Xmx%dm", heapMB),
			"-jar",
			r.jarPath,
		}
		args = append(args, jarArgs...)
		return args
	}
	// For non-java commands (testing), pass everything as plain arguments
	// so the mock command receives them.
	args := []string{r.javaCmd}
	args = append(args, jarArgs...)
	return args
}
