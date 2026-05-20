package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/monitoring/internal/domain"
)

// IngestHandler handles metric pushes from remote agents.
type IngestHandler struct {
	pool *pgxpool.Pool
}

func NewIngestHandler(pool *pgxpool.Pool) *IngestHandler {
	return &IngestHandler{pool: pool}
}

// PushMetrics POST /api/v1/agent/metrics
// Called by the agent binary every N seconds. Authenticated via X-Agent-Key header.
func (h *IngestHandler) PushMetrics(c *fiber.Ctx) error {
	apiKey := c.Get("X-Agent-Key")
	if apiKey == "" {
		return fiber.ErrUnauthorized
	}

	// Resolve server from api_key
	var serverID string
	err := h.pool.QueryRow(c.Context(),
		`UPDATE monitored_servers SET last_seen_at = NOW()
		 WHERE api_key = $1 RETURNING id::text`, apiKey).Scan(&serverID)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid agent key")
	}

	var m domain.ServerMetrics
	if err := c.BodyParser(&m); err != nil {
		return fiber.ErrBadRequest
	}
	m.ServerID = serverID
	m.Timestamp = time.Now()

	_, err = h.pool.Exec(c.Context(),
		`INSERT INTO server_metrics
		   (server_id, collected_at, cpu_percent, ram_percent, ram_total_mb, ram_used_mb,
		    disk_percent, disk_total_mb, disk_used_mb, disk_read_mb_s, disk_write_mb_s,
		    net_in_mb_s, net_out_mb_s, load_avg_1, load_avg_5, load_avg_15, processes, uptime)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
		serverID, m.Timestamp,
		m.CPUPercent, m.RAMPercent, m.RAMTotalMB, m.RAMUsedMB,
		m.DiskPercent, m.DiskTotalMB, m.DiskUsedMB, m.DiskReadMBs, m.DiskWriteMBs,
		m.NetInMBs, m.NetOutMBs,
		m.LoadAvg1, m.LoadAvg5, m.LoadAvg15,
		m.Processes, m.Uptime,
	)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	return c.JSON(fiber.Map{"ok": true})
}

// GetServerMetrics GET /api/v1/monitoring/servers/:id/metrics?period=1h
// Returns time-series snapshots for a server from the Postgres buffer.
func (h *IngestHandler) GetServerMetrics(c *fiber.Ctx) error {
	serverID := c.Params("id")
	period := c.Query("period", "1h")

	interval := periodToInterval(period)

	rows, err := h.pool.Query(c.Context(),
		`SELECT collected_at, cpu_percent, ram_percent, disk_percent,
		        net_in_mb_s, net_out_mb_s, load_avg_1, processes
		 FROM server_metrics
		 WHERE server_id = $1 AND collected_at > NOW() - $2::interval
		 ORDER BY collected_at ASC`, serverID, interval)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	type point struct {
		Time        time.Time `json:"t"`
		CPU         float64   `json:"cpu"`
		RAM         float64   `json:"ram"`
		Disk        float64   `json:"disk"`
		NetIn       float64   `json:"net_in"`
		NetOut      float64   `json:"net_out"`
		Load        float64   `json:"load"`
		Processes   int       `json:"procs"`
	}

	points := []point{}
	for rows.Next() {
		var p point
		if err := rows.Scan(&p.Time, &p.CPU, &p.RAM, &p.Disk,
			&p.NetIn, &p.NetOut, &p.Load, &p.Processes); err == nil {
			points = append(points, p)
		}
	}

	return c.JSON(fiber.Map{
		"server_id": serverID,
		"period":    period,
		"points":    points,
		"total":     len(points),
	})
}

// ListMonitoredServers GET /api/v1/monitoring/servers
func (h *IngestHandler) ListMonitoredServers(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")

	rows, err := h.pool.Query(c.Context(),
		`SELECT id, hostname, ip_address::text, agent_version, last_seen_at, status, created_at
		 FROM monitored_servers WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	type server struct {
		ID           string     `json:"id"`
		Hostname     string     `json:"hostname"`
		IPAddress    *string    `json:"ip_address"`
		AgentVersion *string    `json:"agent_version"`
		LastSeenAt   *time.Time `json:"last_seen_at"`
		Status       string     `json:"status"`
		CreatedAt    time.Time  `json:"created_at"`
	}

	servers := []server{}
	for rows.Next() {
		var s server
		if err := rows.Scan(&s.ID, &s.Hostname, &s.IPAddress, &s.AgentVersion,
			&s.LastSeenAt, &s.Status, &s.CreatedAt); err == nil {
			servers = append(servers, s)
		}
	}

	return c.JSON(fiber.Map{"servers": servers, "total": len(servers)})
}

// RegisterServer POST /api/v1/monitoring/servers
func (h *IngestHandler) RegisterServer(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")

	var req struct {
		Hostname  string `json:"hostname"`
		IPAddress string `json:"ip_address"`
	}
	if err := c.BodyParser(&req); err != nil || req.Hostname == "" {
		return fiber.ErrBadRequest
	}

	// Generate a random API key for this server
	apiKey := generateAPIKey()

	var id string
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO monitored_servers (org_id, hostname, ip_address, api_key)
		 VALUES ($1, $2, $3::inet, $4) RETURNING id::text`,
		orgID, req.Hostname, req.IPAddress, apiKey,
	).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":      id,
		"api_key": apiKey,
		"note":    "Store this api_key securely — it will not be shown again",
	})
}

// DeleteServer DELETE /api/v1/monitoring/servers/:id
func (h *IngestHandler) DeleteServer(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	id := c.Params("id")
	_, err := h.pool.Exec(c.Context(),
		`DELETE FROM monitored_servers WHERE id = $1 AND org_id = $2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func periodToInterval(period string) string {
	switch period {
	case "1h":
		return "1 hour"
	case "6h":
		return "6 hours"
	case "24h":
		return "24 hours"
	case "7d":
		return "7 days"
	case "30d":
		return "30 days"
	default:
		return "1 hour"
	}
}
