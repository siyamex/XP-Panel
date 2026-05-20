package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/ai/internal/llm"
)

// DomainListTool lists domains for an organization.
type DomainListTool struct {
	db *pgxpool.Pool
}

func (t *DomainListTool) Definition() llm.ToolDefinition {
	return llm.ToolDefinition{
		Name:        "list_domains",
		Description: "List all domains/websites configured in this hosting panel. Returns domain names, document roots, PHP version, SSL status, and creation dates.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"org_id": map[string]any{
					"type":        "string",
					"description": "Organization ID to filter by (leave empty for all).",
				},
				"limit": map[string]any{
					"type":        "integer",
					"description": "Maximum number of results (default 20).",
				},
			},
		},
	}
}

func (t *DomainListTool) Execute(ctx context.Context, input map[string]any) (string, error) {
	orgID, _ := input["org_id"].(string)
	limit := 20
	if l, ok := input["limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	var rows interface{ Close() }
	var err error

	if orgID != "" {
		rows, err = t.db.Query(ctx,
			`SELECT domain_name, document_root, php_version, ssl_enabled, status, created_at
			 FROM vhosts WHERE organization_id=$1 ORDER BY domain_name LIMIT $2`,
			orgID, limit)
	} else {
		rows, err = t.db.Query(ctx,
			`SELECT domain_name, document_root, php_version, ssl_enabled, status, created_at
			 FROM vhosts ORDER BY domain_name LIMIT $1`, limit)
	}
	if err != nil {
		return fmt.Sprintf("Error querying domains: %v", err), nil
	}

	type domainRow struct {
		Domain       string `json:"domain"`
		DocumentRoot string `json:"document_root"`
		PHPVersion   string `json:"php_version"`
		SSLEnabled   bool   `json:"ssl_enabled"`
		Status       string `json:"status"`
		CreatedAt    string `json:"created_at"`
	}

	// Type assert to pgx rows
	type pgxRows interface {
		Next() bool
		Scan(...any) error
		Close()
	}
	pgRows, ok := rows.(pgxRows)
	if !ok {
		return "[]", nil
	}
	defer pgRows.Close()

	var domains []domainRow
	for pgRows.Next() {
		var d domainRow
		if err := pgRows.Scan(&d.Domain, &d.DocumentRoot, &d.PHPVersion, &d.SSLEnabled, &d.Status, &d.CreatedAt); err == nil {
			domains = append(domains, d)
		}
	}
	if domains == nil {
		domains = []domainRow{}
	}
	b, _ := json.Marshal(domains)
	return string(b), nil
}
