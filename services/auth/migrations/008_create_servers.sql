-- +goose Up
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hostname VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  ipv6_address INET,
  datacenter VARCHAR(100),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  os_type VARCHAR(50),
  os_version VARCHAR(50),
  agent_version VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning','active','maintenance','offline','error')),
  ssh_port SMALLINT NOT NULL DEFAULT 22,
  api_key_hash TEXT,
  specs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_servers_org ON servers(organization_id);
CREATE INDEX idx_servers_status ON servers(status);

CREATE TRIGGER trg_servers_updated_at
  BEFORE UPDATE ON servers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS servers;
