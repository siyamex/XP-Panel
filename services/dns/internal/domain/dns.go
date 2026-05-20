package domain

import (
	"time"

	"github.com/google/uuid"
)

type Zone struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	DomainID       *uuid.UUID
	Name           string
	Kind           string
	Serial         int64
	Nameservers    []string
	Status         string
	PowerDNSID     string
	Records        []Record
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type Record struct {
	ID        uuid.UUID
	ZoneID    uuid.UUID
	Name      string
	Type      string
	Content   string
	TTL       int
	Priority  int
	Disabled  bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

type RecordType string

const (
	RecordTypeA     RecordType = "A"
	RecordTypeAAAA  RecordType = "AAAA"
	RecordTypeCNAME RecordType = "CNAME"
	RecordTypeMX    RecordType = "MX"
	RecordTypeTXT   RecordType = "TXT"
	RecordTypeNS    RecordType = "NS"
	RecordTypeSOA   RecordType = "SOA"
	RecordTypeSRV   RecordType = "SRV"
	RecordTypeCAA   RecordType = "CAA"
	RecordTypePTR   RecordType = "PTR"
)

// ValidRecordTypes for validation
var ValidRecordTypes = map[string]bool{
	"A": true, "AAAA": true, "CNAME": true, "MX": true, "TXT": true,
	"NS": true, "SOA": true, "SRV": true, "CAA": true, "PTR": true, "NAPTR": true,
}

type CreateZoneRequest struct {
	Name        string   `json:"name" validate:"required,fqdn"`
	Kind        string   `json:"kind" validate:"omitempty,oneof=Native Master Slave"`
	Nameservers []string `json:"nameservers"`
}

type CreateRecordRequest struct {
	Name     string `json:"name" validate:"required"`
	Type     string `json:"type" validate:"required"`
	Content  string `json:"content" validate:"required"`
	TTL      int    `json:"ttl" validate:"min=0,max=86400"`
	Priority int    `json:"priority" validate:"min=0"`
	Disabled bool   `json:"disabled"`
}

type UpdateRecordRequest struct {
	Content  string `json:"content" validate:"required"`
	TTL      int    `json:"ttl" validate:"min=0,max=86400"`
	Priority int    `json:"priority" validate:"min=0"`
	Disabled bool   `json:"disabled"`
}

type RecordTemplate struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	Value    string `json:"value"`
	TTL      int    `json:"ttl"`
	Priority int    `json:"priority,omitempty"`
	Proxied  bool   `json:"proxied,omitempty"`
}
