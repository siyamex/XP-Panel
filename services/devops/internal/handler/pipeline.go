package handler

import (
	"encoding/json"
	"math/rand"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/devops/internal/domain"
)

type PipelineHandler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *PipelineHandler {
	return &PipelineHandler{db: db}
}

func (h *PipelineHandler) ListPipelines(c *fiber.Ctx) error {
	orgID := c.Get("X-Organization-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, name, description, repo_url, branch, trigger, steps, status, last_run_at, created_at
		 FROM pipelines WHERE organization_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	pipelines := []domain.Pipeline{}
	for rows.Next() {
		var p domain.Pipeline
		var stepsJSON []byte
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.RepoURL, &p.Branch, &p.Trigger,
			&stepsJSON, &p.Status, &p.LastRunAt, &p.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(stepsJSON, &p.Steps)
		p.OrganizationID = orgID
		pipelines = append(pipelines, p)
	}
	return c.JSON(fiber.Map{"pipelines": pipelines})
}

func (h *PipelineHandler) GetPipeline(c *fiber.Ctx) error {
	id := c.Params("id")
	var p domain.Pipeline
	var stepsJSON []byte
	err := h.db.QueryRow(c.Context(),
		`SELECT id, name, description, repo_url, branch, trigger, steps, status, last_run_at, created_at
		 FROM pipelines WHERE id=$1`, id).
		Scan(&p.ID, &p.Name, &p.Description, &p.RepoURL, &p.Branch, &p.Trigger,
			&stepsJSON, &p.Status, &p.LastRunAt, &p.CreatedAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "pipeline not found"})
	}
	_ = json.Unmarshal(stepsJSON, &p.Steps)
	return c.JSON(p)
}

func (h *PipelineHandler) CreatePipeline(c *fiber.Ctx) error {
	var req domain.CreatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Branch == "" {
		req.Branch = "main"
	}
	if req.Trigger == "" {
		req.Trigger = "manual"
	}
	orgID := c.Get("X-Organization-ID", "default")
	stepsJSON, _ := json.Marshal(req.Steps)

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO pipelines (organization_id, name, description, repo_url, branch, trigger, steps)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		orgID, req.Name, req.Description, req.RepoURL, req.Branch, req.Trigger, stepsJSON,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"id": id})
}

func (h *PipelineHandler) UpdatePipeline(c *fiber.Ctx) error {
	id := c.Params("id")
	var req domain.UpdatePipelineRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	stepsJSON, _ := json.Marshal(req.Steps)
	_, err := h.db.Exec(c.Context(),
		`UPDATE pipelines SET name=$1, description=$2, repo_url=$3, branch=$4, trigger=$5, steps=$6, updated_at=NOW() WHERE id=$7`,
		req.Name, req.Description, req.RepoURL, req.Branch, req.Trigger, stepsJSON, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"id": id})
}

func (h *PipelineHandler) DeletePipeline(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.db.Exec(c.Context(), `DELETE FROM pipelines WHERE id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// TriggerRun kicks off a pipeline run (simulated async execution)
func (h *PipelineHandler) TriggerRun(c *fiber.Ctx) error {
	pipelineID := c.Params("id")

	// Get pipeline steps
	var stepsJSON []byte
	var steps []domain.PipelineStep
	err := h.db.QueryRow(c.Context(), `SELECT steps FROM pipelines WHERE id=$1`, pipelineID).Scan(&stepsJSON)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "pipeline not found"})
	}
	_ = json.Unmarshal(stepsJSON, &steps)

	// Simulate step results
	results := make([]domain.StepResult, len(steps))
	success := true
	for i, s := range steps {
		status := "success"
		if rand.Float64() < 0.05 { // 5% chance of failure
			status = "failed"
			success = false
		}
		results[i] = domain.StepResult{
			Name:     s.Name,
			Status:   status,
			ExitCode: 0,
			Duration: rand.Intn(8000) + 500,
			Output:   "Step " + s.Name + " executed successfully",
		}
		if status == "failed" {
			results[i].ExitCode = 1
			results[i].Output = "Error: command exited with code 1"
			break
		}
	}

	finalStatus := "success"
	if !success {
		finalStatus = "failed"
	}
	resultsJSON, _ := json.Marshal(results)
	duration := rand.Intn(120) + 10

	var runID string
	now := time.Now()
	finishedAt := now.Add(time.Duration(duration) * time.Second)
	err = h.db.QueryRow(c.Context(),
		`INSERT INTO pipeline_runs (pipeline_id, status, triggered_by, commit_sha, commit_message, started_at, finished_at, duration_seconds, step_results)
		 VALUES ($1,$2,'manual','HEAD','Triggered manually',NOW(),$3,$4,$5) RETURNING id`,
		pipelineID, finalStatus, finishedAt, duration, resultsJSON,
	).Scan(&runID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Update pipeline status and last_run_at
	_, _ = h.db.Exec(c.Context(),
		`UPDATE pipelines SET status=$1, last_run_at=NOW(), updated_at=NOW() WHERE id=$2`, finalStatus, pipelineID)

	return c.Status(202).JSON(fiber.Map{"run_id": runID, "status": finalStatus})
}

func (h *PipelineHandler) ListRuns(c *fiber.Ctx) error {
	pipelineID := c.Params("id")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, status, triggered_by, commit_sha, commit_message, started_at, finished_at, duration_seconds, step_results
		 FROM pipeline_runs WHERE pipeline_id=$1 ORDER BY started_at DESC LIMIT 20`, pipelineID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	runs := []domain.PipelineRun{}
	for rows.Next() {
		var r domain.PipelineRun
		var resultsJSON []byte
		if err := rows.Scan(&r.ID, &r.Status, &r.TriggeredBy, &r.CommitSHA, &r.CommitMessage,
			&r.StartedAt, &r.FinishedAt, &r.DurationSecs, &resultsJSON); err != nil {
			continue
		}
		_ = json.Unmarshal(resultsJSON, &r.StepResults)
		r.PipelineID = pipelineID
		runs = append(runs, r)
	}
	return c.JSON(fiber.Map{"runs": runs})
}

func (h *PipelineHandler) ListDeployments(c *fiber.Ctx) error {
	orgID := c.Get("X-Organization-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, pipeline_id, environment, status, version, deployed_by, deployed_at, finished_at
		 FROM deployments WHERE organization_id=$1 ORDER BY deployed_at DESC LIMIT 50`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	deployments := []domain.Deployment{}
	for rows.Next() {
		var d domain.Deployment
		if err := rows.Scan(&d.ID, &d.PipelineID, &d.Environment, &d.Status, &d.Version,
			&d.DeployedBy, &d.DeployedAt, &d.FinishedAt); err != nil {
			continue
		}
		d.OrganizationID = orgID
		deployments = append(deployments, d)
	}
	return c.JSON(fiber.Map{"deployments": deployments})
}
