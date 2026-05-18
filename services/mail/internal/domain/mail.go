package domain

import (
	"time"

	"github.com/google/uuid"
)

type Mailbox struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	DomainID       *uuid.UUID
	LocalPart      string
	Domain         string
	Email          string // computed: local_part@domain
	QuotaMB        int
	UsedMB         int
	Active         bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type Forwarder struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	SourceLocal    string
	SourceDomain   string
	Source         string // computed: local@domain
	Destinations   []string
	Active         bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type DKIMKey struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	Domain         string
	Selector       string
	PublicKey      string
	DNSTxtValue    string // the full TXT record value
	KeySize        int
	Active         bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CreateMailboxRequest struct {
	LocalPart string `json:"local_part" validate:"required,min=1,max=64"`
	Domain    string `json:"domain" validate:"required"`
	Password  string `json:"password" validate:"required,min=8"`
	QuotaMB   int    `json:"quota_mb"`
}

type UpdateMailboxRequest struct {
	Password string `json:"password"`
	QuotaMB  int    `json:"quota_mb"`
	Active   *bool  `json:"active"`
}

type CreateForwarderRequest struct {
	SourceLocal  string   `json:"source_local" validate:"required"`
	SourceDomain string   `json:"source_domain" validate:"required"`
	Destinations []string `json:"destinations" validate:"required,min=1"`
}

type GenerateDKIMRequest struct {
	Domain   string `json:"domain" validate:"required"`
	Selector string `json:"selector"`
	KeySize  int    `json:"key_size"`
}
