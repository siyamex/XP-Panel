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
	"github.com/xp-panel/xp-panel/services/dns/internal/handler"
	"github.com/xp-panel/xp-panel/services/dns/internal/provider"
	"github.com/xp-panel/xp-panel/services/dns/internal/service"
)

func main() {
	databaseURL := env("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel")
	port := env("PORT", "8082")
	pdnsURL := env("POWERDNS_URL", "")
	pdnsKey := env("POWERDNS_API_KEY", "")
	pdnsServer := env("POWERDNS_SERVER", "localhost")

	// Run migrations
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("open db for migrations: %v", err)
	}
	goose.SetTableName("dns_goose_migrations")
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	db.Close()

	// Connect pool
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	// PowerDNS provider (optional — skipped when URL not configured)
	var pdns *provider.PowerDNS
	pdnsEnabled := pdnsURL != "" && pdnsKey != ""
	if pdnsEnabled {
		pdns = provider.NewPowerDNS(pdnsURL, pdnsKey, pdnsServer)
	}

	zoneSvc := service.NewZoneService(pool, pdns, pdnsEnabled)
	zoneH := handler.NewZoneHandler(zoneSvc)
	recordH := handler.NewRecordHandler(zoneSvc)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel DNS Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "dns"})
	})

	api := app.Group("/api/v1")

	// Mount at both /zones (direct) and /dns/zones (via gateway proxy)
	for _, prefix := range []string{"/zones", "/dns/zones"} {
		zones := api.Group(prefix)
		zones.Get("/", zoneH.List)
		zones.Post("/", zoneH.Create)
		zones.Get("/:id", zoneH.Get)
		zones.Delete("/:id", zoneH.Delete)
		records := zones.Group("/:zoneId/records")
		records.Get("/", recordH.List)
		records.Post("/", recordH.Create)
		records.Put("/:id", recordH.Update)
		records.Delete("/:id", recordH.Delete)
	}


	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("shutting down dns service...")
		_ = app.ShutdownWithTimeout(5 * time.Second)
	}()

	log.Printf("dns service listening on :%s", port)
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
