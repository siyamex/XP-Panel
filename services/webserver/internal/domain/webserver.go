package domain

import (
	"time"

	"github.com/google/uuid"
)

type VHost struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	DomainName     string
	DocumentRoot   string
	ServerType     string
	PHPVersion     string
	SSLEnabled     bool
	SSLCertID      *uuid.UUID
	Status         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type PHPConfig struct {
	ID              uuid.UUID
	VHostID         uuid.UUID
	OrganizationID  uuid.UUID
	PHPVersion      string
	MemoryLimit     string
	MaxExecTime     int
	UploadMaxSize   string
	PostMaxSize     string
	MaxInputVars    int
	OpcacheEnabled  bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type SSLCertificate struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	Domain         string
	SANDomains     []string
	Issuer         string
	ExpiresAt      *time.Time
	AutoRenew      bool
	Provider       string
	ChallengeType  string
	Status         string
	LastError      string
	CertPath       string
	KeyPath        string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CreateVHostRequest struct {
	DomainName   string `json:"domain_name" validate:"required"`
	DocumentRoot string `json:"document_root"`
	ServerType   string `json:"server_type"`
	PHPVersion   string `json:"php_version"`
}

type UpdateVHostRequest struct {
	DocumentRoot string `json:"document_root"`
	PHPVersion   string `json:"php_version"`
	SSLEnabled   *bool  `json:"ssl_enabled"`
	CustomConfig string `json:"custom_config"`
}

type UpdatePHPConfigRequest struct {
	PHPVersion     string `json:"php_version"`
	MemoryLimit    string `json:"memory_limit"`
	MaxExecTime    int    `json:"max_execution_time"`
	UploadMaxSize  string `json:"upload_max_filesize"`
	PostMaxSize    string `json:"post_max_size"`
	MaxInputVars   int    `json:"max_input_vars"`
	OpcacheEnabled *bool  `json:"opcache_enabled"`
}

type IssueSSLRequest struct {
	Domain        string   `json:"domain" validate:"required"`
	SANDomains    []string `json:"san_domains"`
	Provider      string   `json:"provider"`
	ChallengeType string   `json:"challenge_type"`
}
