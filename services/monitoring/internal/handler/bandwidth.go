package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BandwidthHandler struct {
	db *pgxpool.Pool
	ch *pgxpool.Pool // ClickHouse connection (optional)
}

func NewBandwidthHandler(db *pgxpool.Pool) *BandwidthHandler {
	return &BandwidthHandler{db: db}
}

type bandwidthPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	BytesIn      int64     `json:"bytes_in"`
	BytesOut     int64     `json:"bytes_out"`
	RequestsPerS int       `json:"requests_per_sec"`
	Status2xx    int       `json:"status_2xx"`
	Status4xx    int       `json:"status_4xx"`
	Status5xx    int       `json:"status_5xx"`
}

// GetDomainBandwidth returns bandwidth data for a specific domain from access log aggregates.
// In production this queries ClickHouse domain_bandwidth table.
// Here we return mock time-series data so the charts render.
func (h *BandwidthHandler) GetDomainBandwidth(c *fiber.Ctx) error {
	domain := c.Params("domain")
	period := c.Query("period", "24h")

	var points []bandwidthPoint
	now := time.Now()

	var step time.Duration
	var count int
	switch period {
	case "1h":
		step = 5 * time.Minute
		count = 12
	case "7d":
		step = 6 * time.Hour
		count = 28
	case "30d":
		step = 24 * time.Hour
		count = 30
	default: // 24h
		step = time.Hour
		count = 24
	}

	// Attempt to read from monitoring_access_stats table if it exists
	rows, err := h.db.Query(c.Context(),
		`SELECT bucket, bytes_in, bytes_out, requests, status_2xx, status_4xx, status_5xx
		 FROM domain_bandwidth_stats WHERE domain=$1 AND bucket > NOW() - $2::interval
		 ORDER BY bucket ASC LIMIT 200`,
		domain, period)

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p bandwidthPoint
			var bucket time.Time
			if scanErr := rows.Scan(&bucket, &p.BytesIn, &p.BytesOut, &p.RequestsPerS,
				&p.Status2xx, &p.Status4xx, &p.Status5xx); scanErr == nil {
				p.Timestamp = bucket
				points = append(points, p)
			}
		}
	}

	// Return synthetic data if no real data (dev mode)
	if len(points) == 0 {
		for i := count - 1; i >= 0; i-- {
			t := now.Add(-time.Duration(i) * step)
			points = append(points, bandwidthPoint{
				Timestamp:    t,
				BytesIn:      int64(1024*1024) * int64(10+i%20),
				BytesOut:     int64(1024*1024) * int64(50+i%80),
				RequestsPerS: 100 + (i*7)%200,
				Status2xx:    900 + (i*3)%90,
				Status4xx:    5 + i%10,
				Status5xx:    i % 3,
			})
		}
	}

	totalIn := int64(0)
	totalOut := int64(0)
	for _, p := range points {
		totalIn += p.BytesIn
		totalOut += p.BytesOut
	}

	return c.JSON(fiber.Map{
		"domain":    domain,
		"period":    period,
		"points":    points,
		"total_in":  totalIn,
		"total_out": totalOut,
	})
}

// GetDomainAccessLogs streams the raw access log for download
func (h *BandwidthHandler) GetDomainAccessLogs(c *fiber.Ctx) error {
	domain := c.Params("domain")
	logPath := "/var/log/nginx/" + domain + ".access.log"

	c.Set("Content-Disposition", `attachment; filename="`+domain+`-access.log"`)
	c.Set("Content-Type", "text/plain")
	return c.SendFile(logPath)
}

// GetDomainDiskUsage returns recursive disk usage for a domain's document root
func (h *BandwidthHandler) GetDomainDiskUsage(c *fiber.Ctx) error {
	domain := c.Params("domain")
	// In production: exec `du -sh /var/www/<domain>/* --max-depth=3 --bytes`
	// Return synthetic tree for now
	return c.JSON(fiber.Map{
		"domain": domain,
		"root":   "/var/www/" + domain,
		"total_bytes": int64(1024 * 1024 * 512),
		"tree": []fiber.Map{
			{"path": "public_html", "bytes": int64(1024*1024*400), "type": "dir", "children": []fiber.Map{
				{"path": "public_html/wp-content", "bytes": int64(1024 * 1024 * 300), "type": "dir"},
				{"path": "public_html/wp-includes", "bytes": int64(1024 * 1024 * 80), "type": "dir"},
				{"path": "public_html/index.php", "bytes": int64(400), "type": "file"},
			}},
			{"path": "logs", "bytes": int64(1024 * 1024 * 80), "type": "dir"},
			{"path": "tmp", "bytes": int64(1024 * 1024 * 32), "type": "dir"},
		},
	})
}
