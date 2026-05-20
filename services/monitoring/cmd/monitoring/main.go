package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/monitoring/internal/alerting"
	"github.com/xpanel/monitoring/internal/handler"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://xppanel:devpassword@localhost:5432/xppanel"
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	sqlDB := stdlib.OpenDBFromPool(pool)
	runMigrations(sqlDB)

	mh := handler.NewMetricsHandler(pool)

	// Start alerting engine in background
	alertCtx, alertCancel := context.WithCancel(context.Background())
	defer alertCancel()
	go alerting.NewEngine(pool).Start(alertCtx)

	app := fiber.New()
	app.Use(logger.New(), cors.New())

	// WebSocket upgrade middleware
	app.Use("/api/v1/monitoring/metrics/stream", func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	v1 := app.Group("/api/v1")
	mon := v1.Group("/monitoring")
	mon.Get("/metrics/current", mh.Current)
	mon.Get("/metrics/stream", fiberws.New(handler.StreamMetrics))
	mon.Get("/alerts/rules", mh.ListAlertRules)
	mon.Post("/alerts/rules", mh.CreateAlertRule)
	mon.Delete("/alerts/rules/:id", mh.DeleteAlertRule)
	mon.Get("/incidents", mh.ListIncidents)
	mon.Put("/incidents/:id/acknowledge", mh.AcknowledgeIncident)
	mon.Put("/incidents/:id/resolve", mh.ResolveIncident)
	mon.Get("/remediation/logs", mh.ListRemediationLogs)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "monitoring"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}
	log.Printf("Monitoring service running on :%s", port)
	log.Fatal(app.Listen(":" + port))
}

func runMigrations(db *sql.DB) {
	goose.SetTableName("monitoring_goose_migrations")
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
}
