package handler

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/monitoring/internal/collector"
	"github.com/xpanel/monitoring/internal/domain"
)

var metricsPool *pgxpool.Pool

// SetPool wires the DB pool for multi-server WebSocket streams.
func SetPool(p *pgxpool.Pool) { metricsPool = p }

// StreamMetrics pushes server metrics every 5 seconds over WebSocket.
// - server_id=local (default): collect from localhost via gopsutil
// - server_id=<uuid>: pull the latest row from server_metrics table
func StreamMetrics(c *websocket.Conn) {
	serverID := c.Query("server_id", "local")
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	sendMetrics(c, serverID)

	for range ticker.C {
		if err := sendMetrics(c, serverID); err != nil {
			log.Printf("ws send error: %v", err)
			return
		}
	}
}

func sendMetrics(c *websocket.Conn, serverID string) error {
	var metrics *domain.ServerMetrics
	var err error

	if serverID == "local" || metricsPool == nil {
		metrics, err = collector.Collect(serverID)
		if err != nil {
			return err
		}
	} else {
		metrics, err = latestFromDB(serverID)
		if err != nil {
			// Fall back to local collection
			metrics, err = collector.Collect("local")
			if err != nil {
				return err
			}
			metrics.ServerID = serverID
		}
	}

	data, err := json.Marshal(metrics)
	if err != nil {
		return err
	}
	return c.WriteMessage(websocket.TextMessage, data)
}

func latestFromDB(serverID string) (*domain.ServerMetrics, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	m := &domain.ServerMetrics{ServerID: serverID}
	err := metricsPool.QueryRow(ctx,
		`SELECT collected_at, cpu_percent, ram_percent, ram_total_mb, ram_used_mb,
		        disk_percent, disk_total_mb, disk_used_mb, disk_read_mb_s, disk_write_mb_s,
		        net_in_mb_s, net_out_mb_s, load_avg_1, load_avg_5, load_avg_15,
		        processes, uptime
		 FROM server_metrics WHERE server_id = $1
		 ORDER BY collected_at DESC LIMIT 1`, serverID,
	).Scan(
		&m.Timestamp,
		&m.CPUPercent, &m.RAMPercent, &m.RAMTotalMB, &m.RAMUsedMB,
		&m.DiskPercent, &m.DiskTotalMB, &m.DiskUsedMB, &m.DiskReadMBs, &m.DiskWriteMBs,
		&m.NetInMBs, &m.NetOutMBs,
		&m.LoadAvg1, &m.LoadAvg5, &m.LoadAvg15,
		&m.Processes, &m.Uptime,
	)
	if err != nil {
		return nil, err
	}
	return m, nil
}
