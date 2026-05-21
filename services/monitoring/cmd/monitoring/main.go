package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	_ "github.com/ClickHouse/clickhouse-go/v2" // register clickhouse driver
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/monitoring/internal/alerting"
	"github.com/xpanel/monitoring/internal/handler"
	"github.com/xpanel/monitoring/internal/ingester"
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

	// ClickHouse connection (optional — degrades gracefully if absent)
	var chDB *sql.DB
	if chDSN := os.Getenv("CLICKHOUSE_DSN"); chDSN != "" {
		chDB, _ = sql.Open("clickhouse", chDSN)
		if err := chDB.Ping(); err != nil {
			log.Printf("ClickHouse unavailable (%v) — metrics stored in Postgres only", err)
			chDB = nil
		} else {
			log.Println("ClickHouse connected")
		}
	}

	handler.SetPool(pool)
	mh := handler.NewMetricsHandler(pool)
	ih := handler.NewIngestHandler(pool)

	// Start alerting engine in background
	alertCtx, alertCancel := context.WithCancel(context.Background())
	defer alertCancel()
	go alerting.NewEngine(pool).Start(alertCtx)

	// Start ClickHouse ingester in background
	go ingester.New(pool, chDB).Start(alertCtx)

	app := fiber.New()
	app.Use(logger.New(), cors.New())

	// WebSocket upgrade middleware — covers both paths
	wsUpgrade := func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}
	app.Use("/api/v1/monitoring/metrics/stream", wsUpgrade)
	app.Use("/ws/metrics", wsUpgrade)

	v1 := app.Group("/api/v1")
	mon := v1.Group("/monitoring")
	mon.Get("/metrics/current", mh.Current)
	mon.Get("/metrics/stream", fiberws.New(handler.StreamMetrics))

	// Gateway-forwarded WS path: /ws/metrics/:serverId
	app.Get("/ws/metrics/:serverId", fiberws.New(func(c *fiberws.Conn) {
		if c.Query("server_id") == "" {
			c.Locals("serverId", c.Params("serverId"))
		}
		handler.StreamMetrics(c)
	}))
	mon.Get("/alerts/rules", mh.ListAlertRules)
	mon.Post("/alerts/rules", mh.CreateAlertRule)
	mon.Delete("/alerts/rules/:id", mh.DeleteAlertRule)
	mon.Get("/incidents", mh.ListIncidents)
	mon.Put("/incidents/:id/acknowledge", mh.AcknowledgeIncident)
	mon.Put("/incidents/:id/resolve", mh.ResolveIncident)
	mon.Get("/remediation/logs", mh.ListRemediationLogs)

	// Bandwidth + disk usage per domain
	bh := handler.NewBandwidthHandler(pool)
	mon.Get("/bandwidth/:domain",   bh.GetDomainBandwidth)
	mon.Get("/disk/:domain",        bh.GetDomainDiskUsage)
	mon.Get("/logs/:domain",        bh.GetDomainAccessLogs)

	// Monitored servers + time-series metrics
	mon.Get("/servers",             ih.ListMonitoredServers)
	mon.Post("/servers",            ih.RegisterServer)
	mon.Delete("/servers/:id",      ih.DeleteServer)
	mon.Get("/servers/:id/metrics", ih.GetServerMetrics)

	// Agent ingest endpoint (authenticated via X-Agent-Key, not JWT)
	app.Post("/api/v1/agent/metrics", ih.PushMetrics)

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
