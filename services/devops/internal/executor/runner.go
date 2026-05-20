package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	dockertypes "github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/xpanel/devops/internal/domain"
)

// Runner executes pipeline steps inside Docker containers.
type Runner struct {
	docker  *client.Client
	workDir string // host path mounted as /workspace in containers
}

func NewRunner(workDir string) (*Runner, error) {
	dc, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	return &Runner{docker: dc, workDir: workDir}, nil
}

func (r *Runner) Close() { r.docker.Close() }

// RunStep executes a single pipeline step.
// It pulls the image if not present, runs the commands sequentially, and streams output.
// Returns the combined output and exit code.
func (r *Runner) RunStep(ctx context.Context, step domain.PipelineStep, repoPath string) domain.StepResult {
	start := time.Now()

	image := step.Image
	if image == "" {
		image = "alpine:3.19"
	}

	// Pull image (no-op if already present, best-effort)
	pullOut, err := r.docker.ImagePull(ctx, image, dockertypes.ImagePullOptions{})
	if err == nil {
		io.Copy(io.Discard, pullOut) //nolint:errcheck
		pullOut.Close()
	}

	// Build shell script from commands
	script := "set -e\n" + strings.Join(step.Commands, "\n")

	cfg := &container.Config{
		Image:      image,
		Cmd:        []string{"/bin/sh", "-c", script},
		Env:        step.EnvVars,
		WorkingDir: "/workspace",
	}
	hostCfg := &container.HostConfig{
		Binds: []string{repoPath + ":/workspace:rw"},
		// Memory + CPU limits: sensible defaults
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024, // 512 MiB
			NanoCPUs: 1_000_000_000,     // 1 CPU
		},
		NetworkMode: "bridge",
	}

	resp, err := r.docker.ContainerCreate(ctx, cfg, hostCfg, nil, nil, "")
	if err != nil {
		return domain.StepResult{
			Name:     step.Name,
			Status:   "failed",
			ExitCode: -1,
			Duration: int(time.Since(start).Milliseconds()),
			Output:   fmt.Sprintf("container create: %v", err),
		}
	}
	containerID := resp.ID
	defer func() {
		rmCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = r.docker.ContainerRemove(rmCtx, containerID, dockertypes.ContainerRemoveOptions{Force: true})
	}()

	if err := r.docker.ContainerStart(ctx, containerID, dockertypes.ContainerStartOptions{}); err != nil {
		return domain.StepResult{
			Name:     step.Name,
			Status:   "failed",
			ExitCode: -1,
			Duration: int(time.Since(start).Milliseconds()),
			Output:   fmt.Sprintf("container start: %v", err),
		}
	}

	// Wait for completion
	statusCh, errCh := r.docker.ContainerWait(ctx, containerID, container.WaitConditionNotRunning)
	var exitCode int64
	select {
	case waitErr := <-errCh:
		if waitErr != nil && ctx.Err() == nil {
			exitCode = -1
		}
	case status := <-statusCh:
		exitCode = status.StatusCode
	case <-ctx.Done():
		_ = r.docker.ContainerStop(context.Background(), containerID, container.StopOptions{}) //nolint:errcheck
		return domain.StepResult{
			Name:     step.Name,
			Status:   "cancelled",
			ExitCode: -1,
			Duration: int(time.Since(start).Milliseconds()),
			Output:   "step cancelled (context deadline)",
		}
	}

	// Collect logs (truncated at 64 KB)
	logOut, err := r.docker.ContainerLogs(ctx, containerID, dockertypes.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "500",
	})
	var logBuf bytes.Buffer
	if err == nil {
		io.Copy(&logBuf, io.LimitReader(logOut, 64*1024)) //nolint:errcheck
		logOut.Close()
	}

	status := "success"
	if exitCode != 0 {
		status = "failed"
	}
	return domain.StepResult{
		Name:     step.Name,
		Status:   status,
		ExitCode: int(exitCode),
		Duration: int(time.Since(start).Milliseconds()),
		Output:   logBuf.String(),
	}
}
