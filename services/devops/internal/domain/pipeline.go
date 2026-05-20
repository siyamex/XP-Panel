package domain

import "time"

type PipelineStep struct {
	Name      string   `json:"name"`
	Image     string   `json:"image"`
	Commands  []string `json:"commands"`
	EnvVars   []string `json:"env"`
	DependsOn []string `json:"depends_on,omitempty"`
}

type StepResult struct {
	Name     string `json:"name"`
	Status   string `json:"status"`
	ExitCode int    `json:"exit_code"`
	Duration int    `json:"duration_ms"`
	Output   string `json:"output"`
}

type Pipeline struct {
	ID             string         `json:"id"`
	OrganizationID string         `json:"organization_id"`
	Name           string         `json:"name"`
	Description    string         `json:"description"`
	RepoURL        string         `json:"repo_url"`
	Branch         string         `json:"branch"`
	Trigger        string         `json:"trigger"`
	Steps          []PipelineStep `json:"steps"`
	Status         string         `json:"status"`
	LastRunAt      *time.Time     `json:"last_run_at"`
	CreatedAt      time.Time      `json:"created_at"`
}

type PipelineRun struct {
	ID            string       `json:"id"`
	PipelineID    string       `json:"pipeline_id"`
	PipelineName  string       `json:"pipeline_name,omitempty"`
	Status        string       `json:"status"`
	TriggeredBy   string       `json:"triggered_by"`
	CommitSHA     string       `json:"commit_sha"`
	CommitMessage string       `json:"commit_message"`
	StartedAt     time.Time    `json:"started_at"`
	FinishedAt    *time.Time   `json:"finished_at"`
	DurationSecs  *int         `json:"duration_seconds"`
	StepResults   []StepResult `json:"step_results"`
}

type Deployment struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	PipelineID     *string    `json:"pipeline_id"`
	Environment    string     `json:"environment"`
	Status         string     `json:"status"`
	Version        string     `json:"version"`
	DeployedBy     string     `json:"deployed_by"`
	DeployedAt     time.Time  `json:"deployed_at"`
	FinishedAt     *time.Time `json:"finished_at"`
}

type CreatePipelineRequest struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	RepoURL     string         `json:"repo_url"`
	Branch      string         `json:"branch"`
	Trigger     string         `json:"trigger"`
	Steps       []PipelineStep `json:"steps"`
}

type UpdatePipelineRequest struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	RepoURL     string         `json:"repo_url"`
	Branch      string         `json:"branch"`
	Trigger     string         `json:"trigger"`
	Steps       []PipelineStep `json:"steps"`
}
