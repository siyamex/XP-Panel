export interface PipelineStep {
  name: string
  image: string
  commands: string[]
  env: string[]
}

export interface StepResult {
  name: string
  status: 'success' | 'failed' | 'skipped'
  exit_code: number
  duration_ms: number
  output: string
}

export interface Pipeline {
  id: string
  organization_id: string
  name: string
  description: string
  repo_url: string
  branch: string
  trigger: 'manual' | 'push' | 'schedule'
  steps: PipelineStep[]
  status: 'idle' | 'running' | 'success' | 'failed' | 'cancelled'
  last_run_at: string | null
  created_at: string
}

export interface PipelineRun {
  id: string
  pipeline_id: string
  pipeline_name?: string
  status: 'running' | 'success' | 'failed' | 'cancelled'
  triggered_by: string
  commit_sha: string
  commit_message: string
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  step_results: StepResult[]
}

export interface Deployment {
  id: string
  organization_id: string
  pipeline_id: string | null
  environment: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
  version: string
  deployed_by: string
  deployed_at: string
  finished_at: string | null
}

export interface CreatePipelineRequest {
  name: string
  description?: string
  repo_url?: string
  branch: string
  trigger: string
  steps: PipelineStep[]
}
