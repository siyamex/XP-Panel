export interface PortMapping {
  host_port: string
  container_port: string
  protocol: string
}

export interface Container {
  id: string
  container_id: string
  organization_id: string
  name: string
  image: string
  status: string
  state: string
  ports: PortMapping[]
  labels: Record<string, string>
  cpu_percent: number
  memory_usage_mb: number
  memory_limit_mb: number
  created_at: string
}

export interface DockerImage {
  id: string
  tags: string[]
  size_mb: number
  created: number
}

export interface ComposeProject {
  id: string
  organization_id: string
  name: string
  compose_file: string
  status: string
  created_at: string
}

export interface CreateContainerRequest {
  name: string
  image: string
  ports: PortMapping[]
  env: string[]
  labels: Record<string, string>
  restart: string
}

export interface CreateComposeRequest {
  name: string
  compose_file: string
}

export type ContainerAction = 'start' | 'stop' | 'restart' | 'pause' | 'unpause'
export type ComposeAction = 'up' | 'down' | 'restart'
