package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/billing/internal/handler"
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

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	h := handler.New(db)

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
