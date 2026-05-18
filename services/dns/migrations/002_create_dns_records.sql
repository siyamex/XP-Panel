-- +goose Up
CREATE TABLE dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  name VARCHAR(253) NOT NULL,
  type VARCHAR(10) NOT NULL
    CHECK (type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR', 'NAPTR')),
  content TEXT NOT NULL,
  ttl INT NOT NULL DEFAULT 3600,
  priority INT NOT NULL DEFAULT 0,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dns_records_zone ON dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON dns_records(zone_id, type);

CREATE TRIGGER trg_dns_records_updated_at
  BEFORE UPDATE ON dns_records
  FOR EACH ROW EXECUTE FUNCTION update_dns_zones_updated_at();

-- +goose Down
DROP TABLE IF EXISTS dns_records;
