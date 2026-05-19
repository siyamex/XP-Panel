import { apiClient } from './client'
import type { Container, DockerImage, ComposeProject, CreateContainerRequest, CreateComposeRequest, ContainerAction, ComposeAction } from '@/types/docker.types'

const BASE = '/docker'

export const dockerApi = {
  listContainers: () => apiClient.get<{ containers: Container[] }>(`${BASE}/containers`),
  createContainer: (data: CreateContainerRequest) => apiClient.post<{ id: string; container_id: string; status: string }>(`${BASE}/containers`, data),
  containerAction: (id: string, action: ContainerAction) => apiClient.post<{ status: string }>(`${BASE}/containers/${id}/${action}`, {}),
  deleteContainer: (id: string) => apiClient.delete(`${BASE}/containers/${id}`),
  getContainerLogs: (id: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/docker/containers/${id}/logs`,

  listImages: () => apiClient.get<{ images: DockerImage[] }>(`${BASE}/images`),
  pullImage: (image: string) => apiClient.post<{ status: string; image: string }>(`${BASE}/images/pull`, { image }),
  removeImage: (id: string) => apiClient.delete(`${BASE}/images/${id}`),

  listComposeProjects: () => apiClient.get<{ projects: ComposeProject[] }>(`${BASE}/compose`),
  createComposeProject: (data: CreateComposeRequest) => apiClient.post<{ id: string }>(`${BASE}/compose`, data),
  composeAction: (id: string, action: ComposeAction) => apiClient.post<{ status: string }>(`${BASE}/compose/${id}/${action}`, {}),
  deleteComposeProject: (id: string) => apiClient.delete(`${BASE}/compose/${id}`),
}
