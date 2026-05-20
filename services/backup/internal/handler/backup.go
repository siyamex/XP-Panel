package handler

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/backup/internal/crypto"
	"github.com/xpanel/backup/internal/domain"
	"github.com/xpanel/backup/internal/storage"
)

type BackupHandler struct {
	pool    *pgxpool.Pool
	storage *storage.LocalStorage
}

func NewBackupHandler(pool *pgxpool.Pool, store *storage.LocalStorage) *BackupHandler {
	return &BackupHandler{pool: pool, storage: store}
}

// ── Destinations ─────────────────────────────────────────────────────────────

func (h *BackupHandler) ListDestinations(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, name, type, config, created_at
		 FROM backup_destinations WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	dests := []domain.BackupDestination{}
	for rows.Next() {
		var d domain.BackupDestination
		var configJSON []byte
		if err := rows.Scan(&d.ID, &d.OrganizationID, &d.Name, &d.Type, &configJSON, &d.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(configJSON, &d.Config)
		dests = append(dests, d)
	}
	return c.JSON(fiber.Map{"destinations": dests})
}

func (h *BackupHandler) CreateDestination(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Name == "" || req.Type == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name and type are required"})
	}
	if req.Config == nil {
		req.Config = map[string]any{}
	}

	configJSON, _ := json.Marshal(req.Config)

	var d domain.BackupDestination
	var rawConfig []byte
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO backup_destinations (organization_id, name, type, config)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, organization_id, name, type, config, created_at`,
		orgID, req.Name, req.Type, configJSON,
	).Scan(&d.ID, &d.OrganizationID, &d.Name, &d.Type, &rawConfig, &d.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	_ = json.Unmarshal(rawConfig, &d.Config)
	return c.Status(201).JSON(d)
}

func (h *BackupHandler) DeleteDestination(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	ct, err := h.pool.Exec(c.Context(),
		`DELETE FROM backup_destinations WHERE id = $1 AND organization_id = $2`, id, orgID)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "destination not found"})
	}
	return c.SendStatus(204)
}

// ── Backups ───────────────────────────────────────────────────────────────────

func (h *BackupHandler) ListBackups(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, schedule_id, destination_id, name, type, status,
		        size_bytes, storage_path, encrypted, error_message, started_at, completed_at, created_at
		 FROM backups WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	backups := []domain.Backup{}
	for rows.Next() {
		var b domain.Backup
		if err := rows.Scan(&b.ID, &b.OrganizationID, &b.ScheduleID, &b.DestinationID,
			&b.Name, &b.Type, &b.Status, &b.SizeBytes, &b.StoragePath,
			&b.Encrypted, &b.ErrorMessage, &b.StartedAt, &b.CompletedAt, &b.CreatedAt); err != nil {
			continue
		}
		backups = append(backups, b)
	}
	return c.JSON(fiber.Map{"backups": backups, "total": len(backups)})
}

func (h *BackupHandler) CreateBackup(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateBackupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	if req.Name == "" {
		req.Name = fmt.Sprintf("backup-%s-%s", req.Type, time.Now().Format("20060102-150405"))
	}
	if req.Type == "" {
		req.Type = domain.TypeFull
	}

	var b domain.Backup
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO backups (organization_id, destination_id, name, type, status)
		 VALUES ($1, $2, $3, $4, 'pending')
		 RETURNING id, organization_id, schedule_id, destination_id, name, type, status,
		           size_bytes, storage_path, encrypted, error_message, started_at, completed_at, created_at`,
		orgID, req.DestinationID, req.Name, req.Type,
	).Scan(&b.ID, &b.OrganizationID, &b.ScheduleID, &b.DestinationID,
		&b.Name, &b.Type, &b.Status, &b.SizeBytes, &b.StoragePath,
		&b.Encrypted, &b.ErrorMessage, &b.StartedAt, &b.CompletedAt, &b.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	go h.runBackup(b.ID, req)

	return c.Status(202).JSON(b)
}

func (h *BackupHandler) runBackup(backupID string, req domain.CreateBackupRequest) {
	ctx := context.Background()
	now := time.Now()

	h.pool.Exec(ctx,
		`UPDATE backups SET status = 'running', started_at = $1 WHERE id = $2`,
		now, backupID,
	)

	key, err := crypto.GenerateKey()
	if err != nil {
		h.markFailed(backupID, "key generation: "+err.Error())
		return
	}

	archivePath := filepath.Join(os.TempDir(), backupID+".tar.gz.enc")
	f, err := os.Create(archivePath)
	if err != nil {
		h.markFailed(backupID, "create temp file: "+err.Error())
		return
	}

	encWriter, err := crypto.NewEncryptingWriter(key, f)
	if err != nil {
		f.Close()
		h.markFailed(backupID, "encrypt writer: "+err.Error())
		return
	}

	gzw := gzip.NewWriter(encWriter)
	tw := tar.NewWriter(gzw)

	srcDir := "/var/www"
	if _, statErr := os.Stat(srcDir); os.IsNotExist(statErr) {
		srcDir = os.TempDir()
	}

	var sizeBytes int64
	_ = filepath.Walk(srcDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil || info.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(srcDir, path)
		hdr := &tar.Header{
			Name:    rel,
			Size:    info.Size(),
			Mode:    int64(info.Mode()),
			ModTime: info.ModTime(),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		ff, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer ff.Close()
		n, _ := io.Copy(tw, ff)
		sizeBytes += n
		return nil
	})

	tw.Close()
	gzw.Close()
	encWriter.Close()
	f.Close()

	ff, _ := os.Open(archivePath)
	storageKey := fmt.Sprintf("backups/%s.tar.gz.enc", backupID)
	h.storage.Upload(ctx, storageKey, ff)
	ff.Close()
	os.Remove(archivePath)

	completedAt := time.Now()
	h.pool.Exec(ctx,
		`UPDATE backups SET status = 'completed', size_bytes = $1, storage_path = $2,
		        completed_at = $3, encrypted = true WHERE id = $4`,
		sizeBytes, storageKey, completedAt, backupID,
	)
}

func (h *BackupHandler) markFailed(backupID, errMsg string) {
	h.pool.Exec(context.Background(),
		`UPDATE backups SET status = 'failed', error_message = $1 WHERE id = $2`,
		errMsg, backupID,
	)
}

func (h *BackupHandler) DeleteBackup(c *fiber.Ctx) error {
	id := c.Params("id")
	var path *string
	err := h.pool.QueryRow(c.Context(),
		`DELETE FROM backups WHERE id = $1 RETURNING storage_path`, id,
	).Scan(&path)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "backup not found"})
	}
	if path != nil {
		_ = h.storage.Delete(c.Context(), *path)
	}
	return c.SendStatus(204)
}

func (h *BackupHandler) RestoreBackup(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")

	var storagePath *string
	var status string
	err := h.pool.QueryRow(c.Context(),
		`SELECT storage_path, status FROM backups WHERE id = $1 AND organization_id = $2`,
		id, orgID,
	).Scan(&storagePath, &status)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "backup not found"})
	}
	if status != "completed" {
		return c.Status(400).JSON(fiber.Map{"error": "backup is not in completed state"})
	}
	if storagePath == nil {
		return c.Status(400).JSON(fiber.Map{"error": "backup has no storage path"})
	}

	return c.Status(202).JSON(fiber.Map{
		"message":      "restore queued",
		"backup_id":    id,
		"storage_path": *storagePath,
	})
}

// ── Schedules ─────────────────────────────────────────────────────────────────

func (h *BackupHandler) ListSchedules(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, name, cron_expr, destination_id, type, retain_count,
		        enabled, last_run_at, next_run_at, created_at
		 FROM backup_schedules WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	schedules := []domain.BackupSchedule{}
	for rows.Next() {
		var s domain.BackupSchedule
		if err := rows.Scan(&s.ID, &s.OrganizationID, &s.Name, &s.CronExpr, &s.DestinationID,
			&s.Type, &s.RetainCount, &s.Enabled, &s.LastRunAt, &s.NextRunAt, &s.CreatedAt); err != nil {
			continue
		}
		schedules = append(schedules, s)
	}
	return c.JSON(fiber.Map{"schedules": schedules})
}

func (h *BackupHandler) CreateSchedule(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateScheduleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.RetainCount <= 0 {
		req.RetainCount = 7
	}
	if req.Type == "" {
		req.Type = domain.TypeFull
	}

	var s domain.BackupSchedule
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO backup_schedules (organization_id, name, cron_expr, destination_id, type, retain_count)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, organization_id, name, cron_expr, destination_id, type, retain_count,
		           enabled, last_run_at, next_run_at, created_at`,
		orgID, req.Name, req.CronExpr, req.DestinationID, req.Type, req.RetainCount,
	).Scan(&s.ID, &s.OrganizationID, &s.Name, &s.CronExpr, &s.DestinationID,
		&s.Type, &s.RetainCount, &s.Enabled, &s.LastRunAt, &s.NextRunAt, &s.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(s)
}

func (h *BackupHandler) DeleteSchedule(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.pool.Exec(c.Context(), `DELETE FROM backup_schedules WHERE id = $1`, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "schedule not found"})
	}
	return c.SendStatus(204)
}
