package domain

import "time"

type Container struct {
	ID             string            `json:"id"`
	ContainerID    string            `json:"container_id"`
	OrganizationID string            `json:"organization_id"`
	Name           string            `json:"name"`
	Image          string            `json:"image"`
	Status         string            `json:"status"`
	State          string            `json:"state"`
	Ports          []PortMapping     `json:"ports"`
	Labels         map[string]string `json:"labels"`
	CPUPercent     float64           `json:"cpu_percent"`
	MemoryUsageMB  float64           `json:"memory_usage_mb"`
	MemoryLimitMB  float64           `json:"memory_limit_mb"`
	CreatedAt      time.Time         `json:"created_at"`
}

type PortMapping struct {
	HostPort      string `json:"host_port"`
	ContainerPort string `json:"container_port"`
	Protocol      string `json:"protocol"`
}

type ContainerLog struct {
	Timestamp string `json:"timestamp"`
	Stream    string `json:"stream"`
	Log       string `json:"log"`
}

type ComposeProject struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	ComposeFile    string    `json:"compose_file"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type Image struct {
	ID      string   `json:"id"`
	Tags    []string `json:"tags"`
	SizeMB  float64  `json:"size_mb"`
	Created int64    `json:"created"`
}

type CreateContainerRequest struct {
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	Ports   []PortMapping     `json:"ports"`
	Env     []string          `json:"env"`
	Labels  map[string]string `json:"labels"`
	Restart string            `json:"restart"`
}

type CreateComposeRequest struct {
	Name        string `json:"name"`
	ComposeFile string `json:"compose_file"`
}
