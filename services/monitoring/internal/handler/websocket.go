package handler

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/xpanel/monitoring/internal/collector"
)

// StreamMetrics pushes server metrics every 5 seconds over WebSocket.
func StreamMetrics(c *websocket.Conn) {
	serverID := c.Query("server_id", "local")
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Send initial snapshot immediately
	sendMetrics(c, serverID)

	for range ticker.C {
		if err := sendMetrics(c, serverID); err != nil {
			log.Printf("ws send error: %v", err)
			return
		}
	}
}

func sendMetrics(c *websocket.Conn, serverID string) error {
	metrics, err := collector.Collect(serverID)
	if err != nil {
		return err
	}
	data, err := json.Marshal(metrics)
	if err != nil {
		return err
	}
	return c.WriteMessage(websocket.TextMessage, data)
}
