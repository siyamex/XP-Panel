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
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xp-panel/xp-panel/services/mail/internal/handler"
	"github.com/xp-panel/xp-panel/services/mail/internal/service"
)

func main() {
	databaseURL := env("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel")
	port := env("PORT", "8083")

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	goose.SetTableName("mail_goose_migrations")
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	db.Close()

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	svc := service.NewMailboxService(pool)
	mailboxH := handler.NewMailboxHandler(svc)
	forwarderH := handler.NewForwarderHandler(svc)
	dkimH := handler.NewDKIMHandler(svc)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel Mail Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		BodyLimit:    10 * 1024 * 1024,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "mail"})
	})

	api := app.Group("/api/v1")

	mailboxes := api.Group("/mailboxes")
	mailboxes.Get("/", mailboxH.List)
	mailboxes.Post("/", mailboxH.Create)
	mailboxes.Put("/:id", mailboxH.Update)
	mailboxes.Delete("/:id", mailboxH.Delete)

	forwarders := api.Group("/forwarders")
	forwarders.Get("/", forwarderH.List)
	forwarders.Post("/", forwarderH.Create)
	forwarders.Delete("/:id", forwarderH.Delete)

	dkim := api.Group("/dkim")
	dkim.Get("/:domain", dkimH.Get)
	dkim.Post("/generate", dkimH.Generate)
	dkim.Delete("/:domain", dkimH.Delete)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		_ = app.ShutdownWithTimeout(5 * time.Second)
	}()

	log.Printf("mail service listening on :%s", port)
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
