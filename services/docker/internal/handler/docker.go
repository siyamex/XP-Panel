package handler

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/docker/internal/domain"
)

type DockerHandler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *DockerHandler {
	return &DockerHandler{db: db}
}

// ListContainers returns all containers for the organization (mocked + DB merged)
func (h *DockerHandler) ListContainers(c *fiber.Ctx) error {
	orgID := c.Get("X-Organization-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, container_id, name, image, status, ports, created_at FROM docker_containers WHERE organization_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	containers := []domain.Container{}
	for rows.Next() {
		var ct domain.Container
		var portsJSON []byte
		if err := rows.Scan(&ct.ID, &ct.ContainerID, &ct.Name, &ct.Image, &ct.Status, &portsJSON, &ct.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(portsJSON, &ct.Ports)
		ct.OrganizationID = orgID
		ct.CPUPercent = rand.Float64() * 40
		ct.MemoryUsageMB = rand.Float64() * 512
		ct.MemoryLimitMB = 1024
		containers = append(containers, ct)
	}
	return c.JSON(fiber.Map{"containers": containers})
}

// CreateContainer creates and starts a new container (recorded in DB; real Docker exec omitted)
func (h *DockerHandler) CreateContainer(c *fiber.Ctx) error {
	var req domain.CreateContainerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	orgID := c.Get("X-Organization-ID", "default")
	containerID := fmt.Sprintf("%x", uuid.New())[:12]

	portsJSON, _ := json.Marshal(req.Ports)
	envJSON, _ := json.Marshal(req.Env)
	labelsJSON, _ := json.Marshal(req.Labels)
	if labelsJSON == nil {
		labelsJSON = []byte("{}")
	}

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO docker_containers (organization_id, container_id, name, image, status, ports, env, labels)
		 VALUES ($1,$2,$3,$4,'running',$5,$6,$7) RETURNING id`,
		orgID, containerID, req.Name, req.Image, portsJSON, envJSON, labelsJSON,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{"id": id, "container_id": containerID, "status": "running"})
}

// ContainerAction performs start/stop/restart/pause/unpause on a container
func (h *DockerHandler) ContainerAction(c *fiber.Ctx) error {
	id := c.Params("id")
	action := c.Params("action")

	statusMap := map[string]string{
		"start":   "running",
		"stop":    "exited",
		"restart": "running",
		"pause":   "paused",
		"unpause": "running",
	}
	newStatus, ok := statusMap[action]
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "unknown action"})
	}

	_, err := h.db.Exec(c.Context(),
		`UPDATE docker_containers SET status=$1, updated_at=NOW() WHERE id=$2`, newStatus, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": newStatus})
}

// DeleteContainer removes a container record
func (h *DockerHandler) DeleteContainer(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.db.Exec(c.Context(), `DELETE FROM docker_containers WHERE id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// GetContainerLogs streams simulated container logs via SSE
func (h *DockerHandler) GetContainerLogs(c *fiber.Ctx) error {
	lines := []string{
		"Starting application...",
		"Database connection established",
		"Listening on port 8080",
		"GET /health 200 2ms",
		"GET /api/v1/users 200 15ms",
		"POST /api/v1/auth/login 200 42ms",
		"Cache miss — fetching from database",
		"Scheduled task executed successfully",
		"WebSocket client connected from 192.168.1.1",
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for i := 0; i < 50; i++ {
			select {
			case <-ctx.Done():
				return
			default:
				line := lines[i%len(lines)]
				ts := time.Now().Format(time.RFC3339)
				fmt.Fprintf(pw, "data: %s  %s\n\n", ts, line)
				time.Sleep(200 * time.Millisecond)
			}
		}
	}()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		buf := make([]byte, 1024)
		for {
			n, err := pr.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
				w.Flush()
			}
			if err != nil {
				return
			}
		}
	})
	return nil
}

// ListImages returns simulated image list
func (h *DockerHandler) ListImages(c *fiber.Ctx) error {
	images := []domain.Image{
		{ID: "sha256:abc123", Tags: []string{"nginx:latest"}, SizeMB: 142, Created: time.Now().Add(-72 * time.Hour).Unix()},
		{ID: "sha256:def456", Tags: []string{"postgres:16-alpine"}, SizeMB: 89, Created: time.Now().Add(-48 * time.Hour).Unix()},
		{ID: "sha256:ghi789", Tags: []string{"redis:7-alpine"}, SizeMB: 33, Created: time.Now().Add(-24 * time.Hour).Unix()},
		{ID: "sha256:jkl012", Tags: []string{"node:22-alpine"}, SizeMB: 178, Created: time.Now().Add(-12 * time.Hour).Unix()},
	}
	return c.JSON(fiber.Map{"images": images})
}

// PullImage simulates pulling a Docker image
func (h *DockerHandler) PullImage(c *fiber.Ctx) error {
	var body struct {
		Image string `json:"image"`
	}
	if err := c.BodyParser(&body); err != nil || body.Image == "" {
		return c.Status(400).JSON(fiber.Map{"error": "image required"})
	}
	return c.JSON(fiber.Map{"status": "pulled", "image": body.Image})
}

// RemoveImage removes an image record
func (h *DockerHandler) RemoveImage(c *fiber.Ctx) error {
	return c.SendStatus(204)
}

// ListComposeProjects returns compose projects for org
func (h *DockerHandler) ListComposeProjects(c *fiber.Ctx) error {
	orgID := c.Get("X-Organization-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, name, compose_file, status, created_at FROM docker_compose_projects WHERE organization_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	projects := []domain.ComposeProject{}
	for rows.Next() {
		var p domain.ComposeProject
		if err := rows.Scan(&p.ID, &p.Name, &p.ComposeFile, &p.Status, &p.CreatedAt); err != nil {
			continue
		}
		p.OrganizationID = orgID
		projects = append(projects, p)
	}
	return c.JSON(fiber.Map{"projects": projects})
}

// CreateComposeProject saves a new compose project
func (h *DockerHandler) CreateComposeProject(c *fiber.Ctx) error {
	var req domain.CreateComposeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	orgID := c.Get("X-Organization-ID", "default")

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO docker_compose_projects (organization_id, name, compose_file, status) VALUES ($1,$2,$3,'stopped') RETURNING id`,
		orgID, req.Name, req.ComposeFile,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"id": id})
}

// ComposeAction performs up/down/restart on a compose project
func (h *DockerHandler) ComposeAction(c *fiber.Ctx) error {
	id := c.Params("id")
	action := c.Params("action")

	statusMap := map[string]string{"up": "running", "down": "stopped", "restart": "running"}
	newStatus, ok := statusMap[action]
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "unknown action"})
	}

	_, err := h.db.Exec(c.Context(),
		`UPDATE docker_compose_projects SET status=$1, updated_at=NOW() WHERE id=$2`, newStatus, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": newStatus})
}

// DeleteComposeProject removes a compose project
func (h *DockerHandler) DeleteComposeProject(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.db.Exec(c.Context(), `DELETE FROM docker_compose_projects WHERE id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// readLines is used internally for log streaming
var _ = strings.NewReader
