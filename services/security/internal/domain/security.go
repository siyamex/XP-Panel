package domain

import "time"

type FirewallRule struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	ServerID       *string    `json:"server_id"`
	Chain          string     `json:"chain"`
	Action         string     `json:"action"`
	Protocol       *string    `json:"protocol"`
	SourceIP       *string    `json:"source_ip"`
	DestIP         *string    `json:"dest_ip"`
	PortRange      *string    `json:"port_range"`
	Priority       int        `json:"priority"`
	Enabled        bool       `json:"enabled"`
	Comment        *string    `json:"comment"`
	CreatedAt      time.Time  `json:"created_at"`
}

type SecurityEvent struct {
	ID             string         `json:"id"`
	OrganizationID *string        `json:"organization_id"`
	ServerID       *string        `json:"server_id"`
	Type           string         `json:"type"`
	Severity       string         `json:"severity"`
	SourceIP       *string        `json:"source_ip"`
	SourceCountry  *string        `json:"source_country"`
	Target         *string        `json:"target"`
	Details        map[string]any `json:"details"`
	Mitigated      bool           `json:"mitigated"`
	CreatedAt      time.Time      `json:"created_at"`
}

type IPBlocklistEntry struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	IP             string     `json:"ip"`
	Reason         *string    `json:"reason"`
	ExpiresAt      *time.Time `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type SecurityScore struct {
	Score       int      `json:"score"`
	MaxScore    int      `json:"max_score"`
	Grade       string   `json:"grade"`
	Checks      []Check  `json:"checks"`
}

type Check struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
	Weight  int    `json:"weight"`
}

type CreateFirewallRuleRequest struct {
	Chain     string  `json:"chain"`
	Action    string  `json:"action" validate:"required"`
	Protocol  *string `json:"protocol"`
	SourceIP  *string `json:"source_ip"`
	DestIP    *string `json:"dest_ip"`
	PortRange *string `json:"port_range"`
	Priority  int     `json:"priority"`
	Comment   *string `json:"comment"`
}

type BlockIPRequest struct {
	IP     string  `json:"ip" validate:"required"`
	Reason *string `json:"reason"`
}
