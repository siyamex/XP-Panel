package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/ai/internal/llm"
)

// ServerMetricsTool reads the latest server metrics from the DB.
type ServerMetricsTool struct {
	db *pgxpool.Pool
}

func (t *ServerMetricsTool) Definition() llm.ToolDefinition {
	return llm.ToolDefinition{
		Name:        "get_server_metrics",
		Description: "Get the latest CPU, RAM, disk, and network metrics for a server. Use this when the user asks about server performance or resource usage.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"server_id": map[string]any{
					"type":        "string",
					"description": "The server UUID to query. Use 'local' for the current server.",
				},
			},
			"required": []string{"server_id"},
		},
	}
}

func (t *ServerMetricsTool) Execute(ctx context.Context, input map[string]any) (string, error) {
	serverID, _ := input["server_id"].(string)
	if serverID == "" || serverID == "local" {
		serverID = "local"
	}

	var cpu, ram, disk, netIn, netOut float64
	var collectedAt string
	err := t.db.QueryRow(ctx, `
		SELECT cpu_percent, ram_percent, disk_percent, net_in_mb_s, net_out_mb_s, collected_at
		FROM server_metrics
		WHERE server_id = $1
		ORDER BY collected_at DESC
		LIMIT 1`, serverID).
		Scan(&cpu, &ram, &disk, &netIn, &netOut, &collectedAt)
	if err != nil {
		return fmt.Sprintf("No metrics available for server %s.", serverID), nil
	}

	result := map[string]any{
		"server_id":       serverID,
		"cpu_percent":     cpu,
		"ram_percent":     ram,
		"disk_percent":    disk,
		"net_in_mb_s":     netIn,
		"net_out_mb_s":    netOut,
		"collected_at":    collectedAt,
	}
	b, _ := json.Marshal(result)
	return string(b), nil
}
