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

	app := fiber.New()
	app.Use(logger.New(), cors.New())

	// WebSocket upgrade middleware
	app.Use("/api/v1/metrics/stream", func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	v1 := app.Group("/api/v1")
	v1.Get("/metrics/current", mh.Current)
	v1.Get("/metrics/stream", fiberws.New(handler.StreamMetrics))
	v1.Get("/alerts/rules", mh.ListAlertRules)
	v1.Post("/alerts/rules", mh.CreateAlertRule)
	v1.Delete("/alerts/rules/:id", mh.DeleteAlertRule)
	v1.Get("/incidents", mh.ListIncidents)

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
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
}
