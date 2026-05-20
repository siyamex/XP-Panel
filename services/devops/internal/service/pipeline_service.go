package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/devops/internal/domain"
	"github.com/xpanel/devops/internal/executor"
)

const (
	defaultWorkRoot = "/var/lib/xp-panel/devops/workspaces"
	stepTimeout     = 15 * time.Minute
	runTimeout      = 60 * time.Minute
)

// PipelineService orchestrates real pipeline execution.
type PipelineService struct {
	db       *pgxpool.Pool
	workRoot string
}

func New(db *pgxpool.Pool) *PipelineService {
	workRoot := os.Getenv("DEVOPS_WORK_ROOT")
	if workRoot == "" {
		workRoot = defaultWorkRoot
	}
	return &PipelineService{db: db, workRoot: workRoot}
}

// TriggerRun starts a real pipeline run asynchronously.
// It creates the run record immediately (status=running) and executes steps in background.
func (s *PipelineService) TriggerRun(ctx context.Context, pipelineID, triggeredBy string) (string, error) {
	// Load pipeline
	var stepsJSON []byte
	var p domain.Pipeline
	err := s.db.QueryRow(ctx,
		`SELECT id, name, repo_url, branch, steps FROM pipelines WHERE id=$1`, pipelineID).
		Scan(&p.ID, &p.Name, &p.RepoURL, &p.Branch, &stepsJSON)
	if err != nil {
		return "", fmt.Errorf("pipeline not found: %w", err)
	}
	if err := json.Unmarshal(stepsJSON, &p.Steps); err != nil {
		return "", fmt.Errorf("invalid steps JSON: %w", err)
	}

	// Topological sort
	sorted, err := executor.TopoSort(p.Steps)
	if err != nil {
		return "", fmt.Errorf("step ordering: %w", err)
	}

	// Create run record
	var runID string
	err = s.db.QueryRow(ctx,
		`INSERT INTO pipeline_runs (pipeline_id, status, triggered_by, commit_sha, commit_message, started_at)
		 VALUES ($1,'running',$2,'pending','Cloning repository...',NOW()) RETURNING id`,
		pipelineID, triggeredBy).Scan(&runID)
	if err != nil {
		return "", fmt.Errorf("create run record: %w", err)
	}

	// Update pipeline status
	_, _ = s.db.Exec(ctx, `UPDATE pipelines SET status='running', last_run_at=NOW() WHERE id=$1`, pipelineID)

	// Execute in background
	go s.executeRun(pipelineID, runID, p.RepoURL, p.Branch, triggeredBy, sorted)

	return runID, nil
}

func (s *PipelineService) executeRun(pipelineID, runID, repoURL, branch, triggeredBy string, steps []domain.PipelineStep) {
	ctx, cancel := context.WithTimeout(context.Background(), runTimeout)
	defer cancel()

	start := time.Now()

	// Clone/pull repo
	repoPath, commitSHA, err := executor.CloneOrPull(ctx, repoURL, branch, s.workRoot, runID)
	defer executor.Cleanup(s.workRoot, runID)

	if err != nil {
		s.failRun(pipelineID, runID, start, fmt.Sprintf("git clone failed: %v", err))
		return
	}

	// Update commit SHA
	_, _ = s.db.Exec(context.Background(),
		`UPDATE pipeline_runs SET commit_sha=$1, commit_message='Pipeline run' WHERE id=$2`,
		commitSHA[:min(len(commitSHA), 12)], runID)

	// Initialize Docker runner
	runner, err := executor.NewRunner(repoPath)
	if err != nil {
		s.failRun(pipelineID, runID, start, fmt.Sprintf("docker init failed: %v", err))
		return
	}
	defer runner.Close()

	// Execute steps sequentially (DAG already sorted)
	results := make([]domain.StepResult, 0, len(steps))
	finalStatus := "success"

	for _, step := range steps {
		stepCtx, stepCancel := context.WithTimeout(ctx, stepTimeout)
		result := runner.RunStep(stepCtx, step, repoPath)
		stepCancel()

		results = append(results, result)
		s.appendStepLog(runID, result)

		if result.Status == "failed" || result.Status == "cancelled" {
			finalStatus = result.Status
			// Fill remaining steps as skipped
			for _, remaining := range steps[len(results):] {
				results = append(results, domain.StepResult{
					Name:   remaining.Name,
					Status: "skipped",
				})
			}
			break
		}
	}

	// Persist final results
	resultsJSON, _ := json.Marshal(results)
	elapsed := int(time.Since(start).Seconds())
	now := time.Now()

	_, _ = s.db.Exec(context.Background(),
		`UPDATE pipeline_runs
		 SET status=$1, finished_at=$2, duration_seconds=$3, step_results=$4
		 WHERE id=$5`,
		finalStatus, now, elapsed, resultsJSON, runID)

	_, _ = s.db.Exec(context.Background(),
		`UPDATE pipelines SET status=$1, updated_at=NOW() WHERE id=$2`,
		finalStatus, pipelineID)

	log.Printf("pipeline run %s finished: %s (%ds)", runID, finalStatus, elapsed)
}

func (s *PipelineService) failRun(pipelineID, runID string, start time.Time, msg string) {
	elapsed := int(time.Since(start).Seconds())
	now := time.Now()
	results := []domain.StepResult{{Name: "setup", Status: "failed", Output: msg}}
	resultsJSON, _ := json.Marshal(results)

	_, _ = s.db.Exec(context.Background(),
		`UPDATE pipeline_runs SET status='failed', finished_at=$1, duration_seconds=$2, step_results=$3 WHERE id=$4`,
		now, elapsed, resultsJSON, runID)
	_, _ = s.db.Exec(context.Background(),
		`UPDATE pipelines SET status='failed', updated_at=NOW() WHERE id=$1`, pipelineID)
}

func (s *PipelineService) appendStepLog(runID string, result domain.StepResult) {
	// Store incremental step log for streaming; best-effort
	logEntry, _ := json.Marshal(result)
	_, _ = s.db.Exec(context.Background(),
		`INSERT INTO pipeline_run_logs (run_id, step_name, log_line, created_at)
		 VALUES ($1,$2,$3,NOW())`,
		runID, result.Name, string(logEntry))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
