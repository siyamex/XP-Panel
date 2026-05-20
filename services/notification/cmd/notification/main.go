package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/notification/internal/handler"
)

var version = "dev"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8094"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://xppanel:devpassword@localhost:5432/xppanel"
	}

	sqlDB, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	goose.SetTableName("notification_goose_migrations")
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(sqlDB, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
	sqlDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	h := handler.New(db)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel notification " + version,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "notification", "version": version})
	})

	api := app.Group("/api/v1/notifications")
	api.Get("/", h.List)
	api.Put("/:id/read", h.MarkRead)
	api.Put("/read-all", h.MarkAllRead)
	api.Delete("/:id", h.Delete)
	api.Get("/unread-count", h.UnreadCount)
	api.Get("/preferences", h.GetPreferences)
	api.Put("/preferences", h.UpdatePreferences)

	log.Printf("notification service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
