package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/security/internal/handler"
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

	sh := handler.NewSecurityHandler(pool)

	app := fiber.New()
	app.Use(logger.New(), cors.New())

	v1 := app.Group("/api/v1")
	v1.Get("/security/score", sh.Score)
	v1.Get("/security/firewall", sh.ListFirewallRules)
	v1.Post("/security/firewall", sh.CreateFirewallRule)
	v1.Delete("/security/firewall/:id", sh.DeleteFirewallRule)
	v1.Get("/security/events", sh.ListEvents)
	v1.Get("/security/blocklist", sh.ListBlocklist)
	v1.Post("/security/blocklist", sh.BlockIP)
	v1.Delete("/security/blocklist/:id", sh.UnblockIP)
	v1.Get("/security/geoip", sh.ListGeoIPBlocks)
	v1.Post("/security/geoip", sh.AddGeoIPBlock)
	v1.Delete("/security/geoip/:countryCode", sh.RemoveGeoIPBlock)
	v1.Get("/security/geoip/lookup", sh.LookupGeoIP)

	// ModSecurity WAF
	v1.Get("/security/modsec/status",        sh.GetModSecStatus)
	v1.Put("/security/modsec/mode",          sh.SetModSecMode)
	v1.Get("/security/modsec/rules",         sh.ListModSecRules)
	v1.Post("/security/modsec/rules/toggle", sh.ToggleModSecRule)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "security"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8091"
	}
	log.Printf("Security service running on :%s", port)
	log.Fatal(app.Listen(":" + port))
}

func runMigrations(db *sql.DB) {
	goose.SetTableName("security_goose_migrations")
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
}
