package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RemediationAction defines what auto-remediation does when an alert fires.
type RemediationAction struct {
	Type    string         `json:"type"`    // restart_service, clear_cache, scale_up, block_ip, send_alert
	Params  map[string]any `json:"params"`
}

// Remediator runs automated remediation actions triggered by alert rules.
type Remediator struct {
	db *pgxpool.Pool
}

func NewRemediator(db *pgxpool.Pool) *Remediator {
	return &Remediator{db: db}
}

// Execute runs the remediation action for the given alert rule.
// It records the outcome in the remediation_log table.
func (r *Remediator) Execute(ctx context.Context, ruleID, serverID string, action RemediationAction) {
	start := time.Now()
	err := r.run(ctx, action)
	elapsed := time.Since(start)

	status := "success"
	errMsg := ""
	if err != nil {
		status = "failed"
		errMsg = err.Error()
		log.Printf("remediation failed [rule=%s action=%s]: %v", ruleID, action.Type, err)
	} else {
		log.Printf("remediation ok [rule=%s action=%s] in %s", ruleID, action.Type, elapsed.Round(time.Millisecond))
	}

	paramsJSON, _ := json.Marshal(action.Params)
	_, _ = r.db.Exec(ctx,
		`INSERT INTO remediation_log (rule_id, server_id, action_type, action_params, status, error_message, executed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
		ruleID, serverID, action.Type, paramsJSON, status, errMsg)
}

func (r *Remediator) run(ctx context.Context, action RemediationAction) error {
	switch action.Type {
	case "restart_service":
		return r.restartService(ctx, action.Params)
	case "clear_cache":
		return r.clearCache(ctx, action.Params)
	case "reload_service":
		return r.reloadService(ctx, action.Params)
	case "kill_process":
		return r.killProcess(ctx, action.Params)
	case "free_memory":
		return r.freeMemory(ctx)
	case "block_ip":
		return r.blockIP(ctx, action.Params)
	case "noop":
		return nil
	default:
		return fmt.Errorf("unknown remediation action: %q", action.Type)
	}
}

func (r *Remediator) restartService(ctx context.Context, params map[string]any) error {
	svc, _ := params["service"].(string)
	if svc == "" {
		return fmt.Errorf("restart_service: 'service' param required")
	}
	return systemctl(ctx, "restart", svc)
}

func (r *Remediator) reloadService(ctx context.Context, params map[string]any) error {
	svc, _ := params["service"].(string)
	if svc == "" {
		return fmt.Errorf("reload_service: 'service' param required")
	}
	return systemctl(ctx, "reload", svc)
}

func (r *Remediator) clearCache(ctx context.Context, params map[string]any) error {
	cacheType, _ := params["type"].(string)
	switch cacheType {
	case "pagecache", "":
		// echo 1 > /proc/sys/vm/drop_caches (page cache only, non-destructive)
		return runCmd(ctx, "sh", "-c", "sync && echo 1 > /proc/sys/vm/drop_caches")
	case "opcache":
		// Reload PHP-FPM to clear OPcache
		return systemctl(ctx, "reload", "php8.3-fpm")
	case "redis":
		return runCmd(ctx, "redis-cli", "FLUSHDB")
	default:
		return fmt.Errorf("unknown cache type: %q", cacheType)
	}
}

func (r *Remediator) killProcess(ctx context.Context, params map[string]any) error {
	name, _ := params["name"].(string)
	if name == "" {
		return fmt.Errorf("kill_process: 'name' param required")
	}
	// SIGTERM first, SIGKILL after 10s if still running
	_ = runCmd(ctx, "pkill", "-15", "-x", name)
	time.Sleep(2 * time.Second)
	_ = runCmd(ctx, "pkill", "-9", "-x", name)
	return nil
}

func (r *Remediator) freeMemory(ctx context.Context) error {
	// Drop page cache + reclaimable slab (dentries, inodes)
	return runCmd(ctx, "sh", "-c", "sync && echo 3 > /proc/sys/vm/drop_caches")
}

func (r *Remediator) blockIP(ctx context.Context, params map[string]any) error {
	ip, _ := params["ip"].(string)
	if ip == "" {
		return fmt.Errorf("block_ip: 'ip' param required")
	}
	// Block with nftables; fall back to iptables
	if err := runCmd(ctx, "nft", "add", "rule", "ip", "filter", "INPUT",
		"ip", "saddr", ip, "drop"); err != nil {
		return runCmd(ctx, "iptables", "-A", "INPUT", "-s", ip, "-j", "DROP")
	}
	// Record in DB for audit trail
	_, _ = r.db.Exec(ctx,
		`INSERT INTO ip_blocklist (ip_address, reason, blocked_at, blocked_by)
		 VALUES ($1,'auto-remediation',NOW(),'system') ON CONFLICT DO NOTHING`, ip)
	return nil
}

func systemctl(ctx context.Context, action, service string) error {
	return runCmd(ctx, "systemctl", action, service)
}

func runCmd(ctx context.Context, name string, args ...string) error {
	c := exec.CommandContext(ctx, name, args...)
	if out, err := c.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %w — %s", name, err, out)
	}
	return nil
}
