package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/billing/internal/handler"
	"github.com/xpanel/billing/internal/worker"
)

var version = "dev"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://xppanel:devpassword@localhost:5432/xppanel"
	}

	sqlDB, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	goose.SetTableName("billing_goose_migrations")
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(sqlDB, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
	sqlDB.Close()

	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	h := handler.New(db)

	// Start suspension worker
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	notificationURL := os.Getenv("NOTIFICATION_SERVICE_URL")
	go worker.NewSuspensionWorker(db, notificationURL).Start(workerCtx)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel billing " + version,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "billing", "version": version})
	})

	api := app.Group("/api/v1/billing")
	api.Get("/plans", h.ListPlans)
	api.Get("/subscription", h.GetSubscription)
	api.Post("/subscription", h.CreateSubscription)
	api.Delete("/subscription", h.CancelSubscription)
	api.Get("/invoices", h.ListInvoices)
	api.Get("/usage", h.GetUsage)
	api.Post("/webhook/stripe", h.StripeWebhook)

	log.Printf("billing service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
