package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xp-panel/xp-panel/services/domains/internal/handler"
)

func main() {
	dbURL := env("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable")
	port := env("PORT", "8095")

	// Run migrations
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	goose.SetTableName("domains_goose_migrations")
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	db.Close()

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	h := handler.New(pool)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel Domains Service",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "internal server error"
			if e, ok := err.(*fiber.Error); ok {
				code, msg = e.Code, e.Message
			}
			return c.Status(code).JSON(fiber.Map{"error": fiber.Map{"message": msg, "code": code}})
		},
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: env("CORS_ORIGINS", "http://localhost:3000"),
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Org-ID, X-User-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "domains"})
	})

	api := app.Group("/api/v1/domains")
	api.Get("/", h.List)
	api.Post("/", h.Create)
	api.Get("/:id", h.Get)
	api.Delete("/:id", h.Delete)
	api.Post("/:id/suspend", h.Suspend)
	api.Post("/:id/unsuspend", h.Unsuspend)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = app.ShutdownWithContext(ctx)
	}()

	log.Printf("Domains service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
