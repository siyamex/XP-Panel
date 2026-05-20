package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/backup/internal/crypto"
	"github.com/xpanel/backup/internal/domain"
	"github.com/xpanel/backup/internal/storage"
)

// BackupPayload is the asynq task payload for TaskBackupRun.
type BackupPayload struct {
	BackupID       string `json:"backup_id"`
	OrganizationID string `json:"org_id"`
	Type           string `json:"type"`
	DestinationID  string `json:"destination_id,omitempty"`
	EncryptionKey  string `json:"encryption_key,omitempty"` // hex-encoded 32-byte key
}

// PrunePayload is the payload for TaskBackupPrune.
type PrunePayload struct {
	ScheduleID  string `json:"schedule_id"`
	RetainCount int    `json:"retain_count"`
}

// Pool is the asynq worker pool that processes backup jobs.
type Pool struct {
	db     *pgxpool.Pool
	server *asynq.Server
	mux    *asynq.ServeMux
}

// NewPool creates and configures the worker pool.
func NewPool(db *pgxpool.Pool, redisAddr string) *Pool {
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 3, // run up to 3 backups concurrently
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				log.Printf("backup task %s failed: %v", task.Type(), err)
			}),
		},
	)

	p := &Pool{db: db, server: srv, mux: asynq.NewServeMux()}
	p.mux.HandleFunc(TaskBackupRun, p.handleBackupRun)
	p.mux.HandleFunc(TaskBackupPrune, p.handleBackupPrune)
	return p
}

// Start runs the worker pool (blocking).
func (p *Pool) Start() error {
	log.Println("backup worker pool starting")
	return p.server.Run(p.mux)
}

// Shutdown gracefully stops the pool.
func (p *Pool) Shutdown() {
	p.server.Shutdown()
}

// EnqueueBackup enqueues a backup run job.
func EnqueueBackup(redisAddr string, payload BackupPayload, opts ...asynq.Option) error {
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	defer client.Close()

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	task := asynq.NewTask(TaskBackupRun, data, opts...)
	_, err = client.Enqueue(task, asynq.Queue("default"), asynq.MaxRetry(2))
	return err
}

func (p *Pool) handleBackupRun(ctx context.Context, task *asynq.Task) error {
	var payload BackupPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	// Mark running
	_, _ = p.db.Exec(ctx,
		`UPDATE backups SET status='running', started_at=NOW() WHERE id=$1`,
		payload.BackupID)

	if err := p.runBackup(ctx, payload); err != nil {
		errMsg := err.Error()
		_, _ = p.db.Exec(ctx,
			`UPDATE backups SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
			errMsg, payload.BackupID)
		return err
	}
	return nil
}

func (p *Pool) runBackup(ctx context.Context, payload BackupPayload) error {
	// Determine source path based on backup type
	srcPath, err := p.resolveSourcePath(ctx, payload)
	if err != nil {
		return fmt.Errorf("resolve source: %w", err)
	}

	// Create temp archive
	tmpDir := os.TempDir()
	archiveName := fmt.Sprintf("backup_%s_%d.tar.gz", payload.BackupID[:8], time.Now().Unix())
	archivePath := filepath.Join(tmpDir, archiveName)
	defer os.Remove(archivePath)

	if err := archiveDirectory(srcPath, archivePath); err != nil {
		return fmt.Errorf("archive: %w", err)
	}

	// Encrypt if key provided
	finalPath := archivePath
	if payload.EncryptionKey != "" {
		encPath := archivePath + ".enc"
		defer os.Remove(encPath)
		if err := crypto.EncryptFile(archivePath, encPath, []byte(payload.EncryptionKey)); err != nil {
			return fmt.Errorf("encrypt: %w", err)
		}
		finalPath = encPath
	}

	// Upload to destination
	var sizeBytes int64
	var storagePath string

	if payload.DestinationID != "" {
		dest, err := p.loadDestination(ctx, payload.DestinationID)
		if err != nil {
			return fmt.Errorf("load destination: %w", err)
		}
		storagePath, sizeBytes, err = uploadToDestination(ctx, dest, finalPath, archiveName)
		if err != nil {
			return fmt.Errorf("upload: %w", err)
		}
	} else {
		// Local storage fallback
		stat, _ := os.Stat(finalPath)
		if stat != nil {
			sizeBytes = stat.Size()
		}
		localDest := os.Getenv("BACKUP_LOCAL_DIR")
		if localDest == "" {
			localDest = "/var/lib/xp-panel/backups"
		}
		if err := os.MkdirAll(localDest, 0750); err != nil {
			return err
		}
		destFile := filepath.Join(localDest, archiveName)
		if err := os.Rename(finalPath, destFile); err != nil {
			return err
		}
		storagePath = destFile
	}

	_, err = p.db.Exec(ctx,
		`UPDATE backups SET status='completed', size_bytes=$1, storage_path=$2, completed_at=NOW() WHERE id=$3`,
		sizeBytes, storagePath, payload.BackupID)
	return err
}

func (p *Pool) handleBackupPrune(ctx context.Context, task *asynq.Task) error {
	var payload PrunePayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal prune payload: %w", err)
	}

	// Get completed backups for this schedule older than retain_count, newest first
	rows, err := p.db.Query(ctx,
		`SELECT id, storage_path FROM backups
		 WHERE schedule_id=$1 AND status='completed'
		 ORDER BY created_at DESC
		 OFFSET $2`,
		payload.ScheduleID, payload.RetainCount)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var storagePath *string
		if err := rows.Scan(&id, &storagePath); err != nil {
			continue
		}
		// Delete file
		if storagePath != nil && *storagePath != "" {
			_ = os.Remove(*storagePath)
		}
		_, _ = p.db.Exec(ctx, `DELETE FROM backups WHERE id=$1`, id)
		log.Printf("pruned backup %s", id)
	}
	return nil
}

func (p *Pool) resolveSourcePath(ctx context.Context, payload BackupPayload) (string, error) {
	switch domain.BackupType(payload.Type) {
	case domain.TypeFiles:
		// Back up the org's document roots — query vhosts via webserver service is unavailable here,
		// so fall back to a convention-based path
		return fmt.Sprintf("/var/www/org_%s", payload.OrganizationID[:8]), nil
	case domain.TypeDatabase:
		return p.dumpDatabase(ctx, payload.OrganizationID)
	case domain.TypeFull:
		return fmt.Sprintf("/var/www/org_%s", payload.OrganizationID[:8]), nil
	default:
		return fmt.Sprintf("/var/www/org_%s", payload.OrganizationID[:8]), nil
	}
}

func (p *Pool) dumpDatabase(ctx context.Context, orgID string) (string, error) {
	dumpPath := filepath.Join(os.TempDir(), fmt.Sprintf("dbdump_%s_%d", orgID[:8], time.Now().Unix()))
	if err := os.MkdirAll(dumpPath, 0750); err != nil {
		return "", err
	}
	// pg_dump is org-specific; caller must have DATABASE_DUMP_URL configured
	dbURL := os.Getenv("DATABASE_DUMP_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	dumpFile := filepath.Join(dumpPath, "dump.sql")
	cmd := fmt.Sprintf("pg_dump %q > %q", dbURL, dumpFile)
	if err := execShell(ctx, cmd); err != nil {
		return "", fmt.Errorf("pg_dump: %w", err)
	}
	return dumpPath, nil
}

func (p *Pool) loadDestination(ctx context.Context, destID string) (*domain.BackupDestination, error) {
	var dest domain.BackupDestination
	var configJSON []byte
	err := p.db.QueryRow(ctx,
		`SELECT id, name, type, config FROM backup_destinations WHERE id=$1`, destID).
		Scan(&dest.ID, &dest.Name, &dest.Type, &configJSON)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(configJSON, &dest.Config)
	return &dest, nil
}

func uploadToDestination(ctx context.Context, dest *domain.BackupDestination, filePath, fileName string) (string, int64, error) {
	stat, _ := os.Stat(filePath)
	var size int64
	if stat != nil {
		size = stat.Size()
	}

	switch dest.Type {
	case "s3", "minio":
		s3cfg := storage.S3Config{
			Bucket:    stringCfg(dest.Config, "bucket"),
			Region:    stringCfg(dest.Config, "region"),
			Endpoint:  stringCfg(dest.Config, "endpoint"),
			AccessKey: stringCfg(dest.Config, "access_key"),
			SecretKey: stringCfg(dest.Config, "secret_key"),
		}
		s3Store, err := storage.NewS3Store(ctx, s3cfg)
		if err != nil {
			return "", 0, err
		}
		storagePath, err := s3Store.Upload(ctx, filePath, fileName)
		return storagePath, size, err
	case "backblaze":
		b2cfg := storage.B2Config{
			KeyID:      stringCfg(dest.Config, "key_id"),
			AppKey:     stringCfg(dest.Config, "app_key"),
			BucketName: stringCfg(dest.Config, "bucket"),
		}
		b2Store, err := storage.NewB2Store(b2cfg)
		if err != nil {
			return "", 0, err
		}
		storagePath, err := b2Store.Upload(ctx, filePath, fileName)
		return storagePath, size, err
	default:
		localDir := stringCfg(dest.Config, "path")
		if localDir == "" {
			localDir = "/var/lib/xp-panel/backups"
		}
		ls := storage.NewLocalStoreAdapter(localDir)
		storagePath, err := ls.Upload(ctx, filePath, fileName)
		return storagePath, size, err
	}
}

func stringCfg(cfg map[string]any, key string) string {
	if v, ok := cfg[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
