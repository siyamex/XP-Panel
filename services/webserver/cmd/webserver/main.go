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
	"github.com/xp-panel/xp-panel/services/webserver/internal/service"
)

func main() {
	databaseURL := env("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel")
	port := env("PORT", "8084")
	nginxConfigDir := env("NGINX_CONFIG_DIR", "/etc/nginx/sites-enabled")
	phpPoolDir := env("PHP_POOL_DIR", "/etc/php/8.3/fpm/pool.d")
	dryRun := env("DRY_RUN", "true") == "true"

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	goose.SetTableName("webserver_goose_migrations")
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	db.Close()

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("pgxpool: %v", err)
	}
	defer pool.Close()

	nginxSvc := service.NewNginxService(nginxConfigDir, "internal/templates", dryRun)
	phpSvc := service.NewPHPService(phpPoolDir, dryRun)
	sslSvc := service.NewSSLService(pool, dryRun)
	vhostSvc := service.NewVHostService(pool, nginxSvc, phpSvc)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel Webserver Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "webserver"})
	})

	api := app.Group("/api/v1")

	// VHost routes
	vhosts := api.Group("/vhosts")
	vhosts.Get("/", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		list, err := vhostSvc.ListVHosts(c.Context(), orgID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"vhosts": list, "total": len(list)})
	})
	vhosts.Post("/", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		var req service.CreateVHostReq
		if err := c.BodyParser(&req); err != nil {
			return fiber.ErrBadRequest
		}
		v, err := vhostSvc.CreateVHost(c.Context(), orgID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(v)
	})
	vhosts.Delete("/:id", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		id := mustUUID(c, "id")
		if err := vhostSvc.DeleteVHost(c.Context(), id, orgID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	// SSL routes
	ssl := api.Group("/ssl")
	ssl.Get("/", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		list, err := sslSvc.ListCertificates(c.Context(), orgID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(fiber.Map{"certificates": list, "total": len(list)})
	})
	ssl.Post("/issue", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		var req service.IssueSSLReq
		if err := c.BodyParser(&req); err != nil {
			return fiber.ErrBadRequest
		}
		cert, err := sslSvc.IssueCertificate(c.Context(), orgID, req)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(cert)
	})
	ssl.Post("/:id/renew", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		id := mustUUID(c, "id")
		cert, err := sslSvc.RenewCertificate(c.Context(), id, orgID)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(cert)
	})
	ssl.Delete("/:id", func(c *fiber.Ctx) error {
		orgID := mustOrgID(c)
		id := mustUUID(c, "id")
		if err := sslSvc.DeleteCertificate(c.Context(), id, orgID); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.SendStatus(fiber.StatusNoContent)
	})

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		_ = app.ShutdownWithTimeout(5 * time.Second)
	}()

	log.Printf("webserver service listening on :%s", port)
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

func mustOrgID(c *fiber.Ctx) interface{} {
	return c.Get("X-Org-ID")
}

func mustUUID(c *fiber.Ctx, param string) interface{} {
	return c.Params(param)
}
