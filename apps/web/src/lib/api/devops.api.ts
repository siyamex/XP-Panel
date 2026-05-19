import { apiClient } from './client'
import type { Pipeline, PipelineRun, Deployment, CreatePipelineRequest } from '@/types/devops.types'

const BASE = '/devops'

export const devopsApi = {
  listPipelines: () => apiClient.get<{ pipelines: Pipeline[] }>(`${BASE}/pipelines`),
  getPipeline: (id: string) => apiClient.get<Pipeline>(`${BASE}/pipelines/${id}`),
  createPipeline: (data: CreatePipelineRequest) => apiClient.post<{ id: string }>(`${BASE}/pipelines`, data),
  updatePipeline: (id: string, data: Partial<CreatePipelineRequest>) => apiClient.put<{ id: string }>(`${BASE}/pipelines/${id}`, data),
  deletePipeline: (id: string) => apiClient.delete(`${BASE}/pipelines/${id}`),
  triggerRun: (id: string) => apiClient.post<{ run_id: string; status: string }>(`${BASE}/pipelines/${id}/run`, {}),
  listRuns: (pipelineId: string) => apiClient.get<{ runs: PipelineRun[] }>(`${BASE}/pipelines/${pipelineId}/runs`),
  listDeployments: () => apiClient.get<{ deployments: Deployment[] }>(`${BASE}/deployments`),
}
