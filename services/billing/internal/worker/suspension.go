package worker

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SuspensionWorker checks subscriptions hourly and suspends organizations
// whose subscription has expired or been cancelled past period end.
type SuspensionWorker struct {
	db              *pgxpool.Pool
	notificationURL string
}

func NewSuspensionWorker(db *pgxpool.Pool, notificationURL string) *SuspensionWorker {
	return &SuspensionWorker{db: db, notificationURL: notificationURL}
}

func (w *SuspensionWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	// Run once immediately on start
	w.run(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.run(ctx)
		}
	}
}

func (w *SuspensionWorker) run(ctx context.Context) {
	// Suspend orgs whose subscription period ended and status is still active
	ct, err := w.db.Exec(ctx, `
		UPDATE organizations SET status='suspended', updated_at=NOW()
		WHERE id IN (
			SELECT organization_id FROM subscriptions
			WHERE status NOT IN ('active','trialing')
			   OR (cancel_at_period_end = TRUE AND current_period_end < NOW())
			   OR (status = 'active' AND current_period_end < NOW() - INTERVAL '3 days')
		) AND status = 'active'
	`)
	if err != nil {
		log.Printf("suspension worker: %v", err)
		return
	}
	if ct.RowsAffected() > 0 {
		log.Printf("suspension worker: suspended %d organizations", ct.RowsAffected())
	}

	// Reactivate orgs that have a valid subscription again (e.g. payment recovered)
	ct, err = w.db.Exec(ctx, `
		UPDATE organizations SET status='active', updated_at=NOW()
		WHERE id IN (
			SELECT organization_id FROM subscriptions
			WHERE status = 'active'
			  AND current_period_end > NOW()
			  AND cancel_at_period_end = FALSE
		) AND status = 'suspended'
	`)
	if err != nil {
		log.Printf("suspension worker reactivate: %v", err)
		return
	}
	if ct.RowsAffected() > 0 {
		log.Printf("suspension worker: reactivated %d organizations", ct.RowsAffected())
	}
}
