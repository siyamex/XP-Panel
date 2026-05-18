package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/dns/internal/domain"
	"github.com/xp-panel/xp-panel/services/dns/internal/provider"
)

var (
	ErrZoneNotFound   = errors.New("dns zone not found")
	ErrRecordNotFound = errors.New("dns record not found")
	ErrZoneExists     = errors.New("dns zone already exists")
)

type ZoneService struct {
	db      *pgxpool.Pool
	pdns    *provider.PowerDNS
	enabled bool // false when PowerDNS not configured
}

func NewZoneService(db *pgxpool.Pool, pdns *provider.PowerDNS, pdnsEnabled bool) *ZoneService {
	return &ZoneService{db: db, pdns: pdns, enabled: pdnsEnabled}
}

func (s *ZoneService) ListZones(ctx context.Context, orgID uuid.UUID) ([]domain.Zone, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, organization_id, domain_id, name, kind, serial,
		       nameservers, status, powerdns_id, created_at, updated_at
		FROM dns_zones WHERE organization_id = $1 ORDER BY name`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var zones []domain.Zone
	for rows.Next() {
		var z domain.Zone
		if err := rows.Scan(&z.ID, &z.OrganizationID, &z.DomainID, &z.Name,
			&z.Kind, &z.Serial, &z.Nameservers, &z.Status,
			&z.PowerDNSID, &z.CreatedAt, &z.UpdatedAt); err != nil {
			return nil, err
		}
		zones = append(zones, z)
	}
	return zones, nil
}

func (s *ZoneService) GetZone(ctx context.Context, id, orgID uuid.UUID) (*domain.Zone, error) {
	var z domain.Zone
	err := s.db.QueryRow(ctx, `
		SELECT id, organization_id, domain_id, name, kind, serial,
		       nameservers, status, powerdns_id, created_at, updated_at
		FROM dns_zones WHERE id = $1 AND organization_id = $2`, id, orgID).
		Scan(&z.ID, &z.OrganizationID, &z.DomainID, &z.Name,
			&z.Kind, &z.Serial, &z.Nameservers, &z.Status,
			&z.PowerDNSID, &z.CreatedAt, &z.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrZoneNotFound
		}
		return nil, err
	}

	records, err := s.listRecords(ctx, z.ID)
	if err != nil {
		return nil, err
	}
	z.Records = records
	return &z, nil
}

func (s *ZoneService) CreateZone(ctx context.Context, orgID uuid.UUID, req domain.CreateZoneRequest) (*domain.Zone, error) {
	name := strings.ToLower(strings.TrimSuffix(req.Name, "."))
	kind := req.Kind
	if kind == "" {
		kind = "Native"
	}

	// Check for duplicate
	var exists bool
	_ = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dns_zones WHERE name = $1)`, name).Scan(&exists)
	if exists {
		return nil, ErrZoneExists
	}

	var pdnsID string
	if s.enabled {
		id, err := s.pdns.CreateZone(name, kind, req.Nameservers)
		if err != nil {
			return nil, fmt.Errorf("powerdns create zone: %w", err)
		}
		pdnsID = id
	}

	z := domain.Zone{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Name:           name,
		Kind:           kind,
		Serial:         int64(time.Now().Unix()),
		Nameservers:    req.Nameservers,
		Status:         "active",
		PowerDNSID:     pdnsID,
	}

	_, err := s.db.Exec(ctx, `
		INSERT INTO dns_zones (id, organization_id, name, kind, serial, nameservers, status, powerdns_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		z.ID, z.OrganizationID, z.Name, z.Kind, z.Serial, z.Nameservers, z.Status, z.PowerDNSID)
	if err != nil {
		return nil, err
	}
	return &z, nil
}

func (s *ZoneService) DeleteZone(ctx context.Context, id, orgID uuid.UUID) error {
	var pdnsID string
	err := s.db.QueryRow(ctx, `SELECT powerdns_id FROM dns_zones WHERE id = $1 AND organization_id = $2`,
		id, orgID).Scan(&pdnsID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrZoneNotFound
		}
		return err
	}

	if s.enabled && pdnsID != "" {
		_ = s.pdns.DeleteZone(pdnsID)
	}

	_, err = s.db.Exec(ctx, `DELETE FROM dns_zones WHERE id = $1`, id)
	return err
}

func (s *ZoneService) ListRecords(ctx context.Context, zoneID, orgID uuid.UUID) ([]domain.Record, error) {
	// Verify ownership
	var exists bool
	_ = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dns_zones WHERE id = $1 AND organization_id = $2)`,
		zoneID, orgID).Scan(&exists)
	if !exists {
		return nil, ErrZoneNotFound
	}
	return s.listRecords(ctx, zoneID)
}

func (s *ZoneService) listRecords(ctx context.Context, zoneID uuid.UUID) ([]domain.Record, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, zone_id, name, type, content, ttl, priority, disabled, created_at, updated_at
		FROM dns_records WHERE zone_id = $1 ORDER BY type, name`, zoneID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []domain.Record
	for rows.Next() {
		var r domain.Record
		if err := rows.Scan(&r.ID, &r.ZoneID, &r.Name, &r.Type,
			&r.Content, &r.TTL, &r.Priority, &r.Disabled,
			&r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	return records, nil
}

func (s *ZoneService) CreateRecord(ctx context.Context, zoneID, orgID uuid.UUID, req domain.CreateRecordRequest) (*domain.Record, error) {
	var zone domain.Zone
	err := s.db.QueryRow(ctx, `SELECT id, name, powerdns_id FROM dns_zones WHERE id = $1 AND organization_id = $2`,
		zoneID, orgID).Scan(&zone.ID, &zone.Name, &zone.PowerDNSID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrZoneNotFound
		}
		return nil, err
	}

	if req.TTL == 0 {
		req.TTL = 3600
	}

	r := domain.Record{
		ID:       uuid.New(),
		ZoneID:   zoneID,
		Name:     req.Name,
		Type:     req.Type,
		Content:  req.Content,
		TTL:      req.TTL,
		Priority: req.Priority,
		Disabled: req.Disabled,
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO dns_records (id, zone_id, name, type, content, ttl, priority, disabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		r.ID, r.ZoneID, r.Name, r.Type, r.Content, r.TTL, r.Priority, r.Disabled)
	if err != nil {
		return nil, err
	}

	if s.enabled && zone.PowerDNSID != "" {
		_ = s.pdns.UpsertRecord(zone.PowerDNSID, r.Name, r.Type, r.Content, r.TTL, r.Priority, r.Disabled)
	}
	return &r, nil
}

func (s *ZoneService) UpdateRecord(ctx context.Context, recordID, zoneID, orgID uuid.UUID, req domain.UpdateRecordRequest) (*domain.Record, error) {
	var zone domain.Zone
	err := s.db.QueryRow(ctx, `SELECT id, name, powerdns_id FROM dns_zones WHERE id = $1 AND organization_id = $2`,
		zoneID, orgID).Scan(&zone.ID, &zone.Name, &zone.PowerDNSID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrZoneNotFound
		}
		return nil, err
	}

	var r domain.Record
	err = s.db.QueryRow(ctx, `
		UPDATE dns_records SET content = $1, ttl = $2, priority = $3, disabled = $4
		WHERE id = $5 AND zone_id = $6
		RETURNING id, zone_id, name, type, content, ttl, priority, disabled, created_at, updated_at`,
		req.Content, req.TTL, req.Priority, req.Disabled, recordID, zoneID).
		Scan(&r.ID, &r.ZoneID, &r.Name, &r.Type, &r.Content, &r.TTL, &r.Priority, &r.Disabled, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}

	if s.enabled && zone.PowerDNSID != "" {
		_ = s.pdns.UpsertRecord(zone.PowerDNSID, r.Name, r.Type, r.Content, r.TTL, r.Priority, r.Disabled)
	}
	return &r, nil
}

func (s *ZoneService) DeleteRecord(ctx context.Context, recordID, zoneID, orgID uuid.UUID) error {
	var zone domain.Zone
	err := s.db.QueryRow(ctx, `SELECT id, powerdns_id FROM dns_zones WHERE id = $1 AND organization_id = $2`,
		zoneID, orgID).Scan(&zone.ID, &zone.PowerDNSID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrZoneNotFound
		}
		return err
	}

	var r domain.Record
	err = s.db.QueryRow(ctx, `DELETE FROM dns_records WHERE id = $1 AND zone_id = $2 RETURNING name, type`,
		recordID, zoneID).Scan(&r.Name, &r.Type)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrRecordNotFound
		}
		return err
	}

	if s.enabled && zone.PowerDNSID != "" {
		_ = s.pdns.DeleteRecord(zone.PowerDNSID, r.Name, r.Type)
	}
	return nil
}
