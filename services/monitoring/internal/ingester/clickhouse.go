package ingester

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ClickHouseIngester drains the server_metrics Postgres buffer into ClickHouse
// in batches every 30 seconds. If ClickHouse is unavailable it skips silently —
// the Postgres buffer retains rows with forwarded_to_ch=false for retry.
type ClickHouseIngester struct {
	pg       *pgxpool.Pool
	ch       *sql.DB // ClickHouse via database/sql driver
	interval time.Duration
	batchSize int
}

func New(pg *pgxpool.Pool, ch *sql.DB) *ClickHouseIngester {
	return &ClickHouseIngester{
		pg:        pg,
		ch:        ch,
		interval:  30 * time.Second,
		batchSize: 1000,
	}
}

// Start runs the ingester loop. Call in a goroutine.
func (i *ClickHouseIngester) Start(ctx context.Context) {
	if i.ch == nil {
		log.Println("ClickHouse ingester: no CH connection — persistence via Postgres only")
		return
	}

	if err := i.ensureTable(ctx); err != nil {
		log.Printf("ClickHouse ingester: schema error: %v", err)
		return
	}

	ticker := time.NewTicker(i.interval)
	defer ticker.Stop()
	log.Println("ClickHouse ingester started (30s batch interval)")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := i.flush(ctx); err != nil {
				log.Printf("ClickHouse flush error: %v", err)
			}
		}
	}
}

type metricRow struct {
	id            int64
	serverID      string
	collectedAt   time.Time
	cpuPercent    float64
	ramPercent    float64
	ramTotalMB    int64
	ramUsedMB     int64
	diskPercent   float64
	diskTotalMB   int64
	diskUsedMB    int64
	diskReadMBs   float64
	diskWriteMBs  float64
	netInMBs      float64
	netOutMBs     float64
	loadAvg1      float64
	loadAvg5      float64
	loadAvg15     float64
	processes     int
	uptime        int64
}

func (i *ClickHouseIngester) flush(ctx context.Context) error {
	rows, err := i.pg.Query(ctx,
		`SELECT id, server_id, collected_at,
		        cpu_percent, ram_percent, ram_total_mb, ram_used_mb,
		        disk_percent, disk_total_mb, disk_used_mb, disk_read_mb_s, disk_write_mb_s,
		        net_in_mb_s, net_out_mb_s,
		        load_avg_1, load_avg_5, load_avg_15,
		        processes, uptime
		 FROM server_metrics WHERE forwarded_to_ch = FALSE
		 ORDER BY collected_at ASC LIMIT $1`, i.batchSize)
	if err != nil {
		return fmt.Errorf("pg query: %w", err)
	}
	defer rows.Close()

	var batch []metricRow
	var ids []int64

	for rows.Next() {
		var r metricRow
		if err := rows.Scan(
			&r.id, &r.serverID, &r.collectedAt,
			&r.cpuPercent, &r.ramPercent, &r.ramTotalMB, &r.ramUsedMB,
			&r.diskPercent, &r.diskTotalMB, &r.diskUsedMB, &r.diskReadMBs, &r.diskWriteMBs,
			&r.netInMBs, &r.netOutMBs,
			&r.loadAvg1, &r.loadAvg5, &r.loadAvg15,
			&r.processes, &r.uptime,
		); err == nil {
			batch = append(batch, r)
			ids = append(ids, r.id)
		}
	}
	rows.Close()

	if len(batch) == 0 {
		return nil
	}

	if err := i.insertBatch(ctx, batch); err != nil {
		return fmt.Errorf("ch insert: %w", err)
	}

	// Mark as forwarded in Postgres
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for j, id := range ids {
		placeholders[j] = fmt.Sprintf("$%d", j+1)
		args[j] = id
	}
	_, err = i.pg.Exec(ctx,
		fmt.Sprintf(`UPDATE server_metrics SET forwarded_to_ch = TRUE WHERE id IN (%s)`,
			strings.Join(placeholders, ",")),
		args...)
	if err != nil {
		return fmt.Errorf("pg mark forwarded: %w", err)
	}

	log.Printf("ClickHouse ingester: flushed %d rows", len(batch))
	return nil
}

func (i *ClickHouseIngester) insertBatch(ctx context.Context, rows []metricRow) error {
	tx, err := i.ch.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO server_metrics
		   (server_id, timestamp, cpu_percent, ram_percent, ram_total_mb, ram_used_mb,
		    disk_percent, disk_total_mb, disk_used_mb, disk_read_mb_s, disk_write_mb_s,
		    net_in_mb_s, net_out_mb_s, load_avg_1, load_avg_5, load_avg_15,
		    process_count, uptime_seconds)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, r := range rows {
		_, err = stmt.ExecContext(ctx,
			r.serverID, r.collectedAt,
			r.cpuPercent, r.ramPercent, r.ramTotalMB, r.ramUsedMB,
			r.diskPercent, r.diskTotalMB, r.diskUsedMB, r.diskReadMBs, r.diskWriteMBs,
			r.netInMBs, r.netOutMBs,
			r.loadAvg1, r.loadAvg5, r.loadAvg15,
			r.processes, r.uptime,
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (i *ClickHouseIngester) ensureTable(ctx context.Context) error {
	_, err := i.ch.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS server_metrics (
			server_id        String,
			timestamp        DateTime64(3, 'UTC'),
			cpu_percent      Float32,
			ram_percent      Float32,
			ram_total_mb     UInt64,
			ram_used_mb      UInt64,
			disk_percent     Float32,
			disk_total_mb    UInt64,
			disk_used_mb     UInt64,
			disk_read_mb_s   Float32,
			disk_write_mb_s  Float32,
			net_in_mb_s      Float32,
			net_out_mb_s     Float32,
			load_avg_1       Float32,
			load_avg_5       Float32,
			load_avg_15      Float32,
			process_count    UInt32,
			uptime_seconds   UInt64
		) ENGINE = MergeTree()
		PARTITION BY toYYYYMM(timestamp)
		ORDER BY (server_id, timestamp)
		TTL timestamp + INTERVAL 90 DAY
	`)
	return err
}
