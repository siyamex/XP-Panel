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
	"github.com/xp-panel/xp-panel/services/webserver/internal/handler"
	"github.com/xp-panel/xp-panel/services/webserver/internal/service"
)

func main() {
	dbURL := env("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable")
	port := env("PORT", "8084")

	db, err := sql.Open("pgx", dbURL)
	if err != nil { log.Fatalf("open db: %v", err) }
	goose.SetTableName("webserver_goose_migrations")
	if err := goose.Up(db, "migrations"); err != nil { log.Fatalf("migrations: %v", err) }
	db.Close()

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil { log.Fatalf("pgxpool: %v", err) }
	defer pool.Close()

	// Service configuration from environment
	nginxConfigDir  := env("NGINX_CONFIG_DIR", "/etc/nginx/sites-enabled")
	templateDir     := env("TEMPLATE_DIR", "/etc/xp-panel/templates")
	phpPoolDir      := env("PHP_POOL_DIR", "/etc/php/fpm/pool.d")
	certsDir        := env("CERTS_DIR", "/etc/xp-panel/certs")
	acmeEmail       := env("ACME_EMAIL", "admin@example.com")
	staging         := env("ACME_STAGING", "true") == "true" // default staging in dev
	dryRun          := env("WEBSERVER_DRY_RUN", "false") != "false"

	nginxSvc := service.NewNginxService(nginxConfigDir, templateDir, dryRun)
	phpSvc   := service.NewPHPService(phpPoolDir, dryRun)
	sslSvc   := service.NewSSLService(pool, nginxSvc, certsDir, acmeEmail, staging)

	// Start SSL auto-renewal background task
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go sslSvc.StartAutoRenewal(ctx)

	h := handler.New(pool, nginxSvc, phpSvc, sslSvc)
	app := fiber.New(fiber.Config{
		AppName: "XP-Panel WebServer Service",
		ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := 500; msg := "internal server error"
			if e, ok := err.(*fiber.Error); ok { code, msg = e.Code, e.Message }
			return c.Status(code).JSON(fiber.Map{"error": fiber.Map{"message": msg, "code": code}})
		},
	})
	app.Use(recover.New(), logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: env("CORS_ORIGINS", "http://localhost:3000"),
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Org-ID, X-User-ID",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "webserver"})
	})

	api := app.Group("/api/v1/webserver")
	api.Get("/vhosts",          h.ListVhosts)
	api.Post("/vhosts",         h.CreateVhost)
	api.Get("/vhosts/:id",      h.GetVhost)
	api.Delete("/vhosts/:id",   h.DeleteVhost)
	api.Put("/vhosts/:id",      h.UpdateVhost)
	api.Get("/ssl",                    h.ListSSLCerts)
	api.Get("/ssl/:id",               h.GetSSLCert)
	api.Post("/ssl/issue",            h.IssueSSLCert)
	api.Post("/ssl/renew/:id",        h.RenewSSLCert)
	api.Delete("/ssl/:id",            h.DeleteSSLCert)
	api.Put("/ssl/:id/auto-renew",    h.ToggleAutoRenew)
	api.Get("/php",                          h.ListPHP)
	api.Put("/php/:vhostId",                 h.UpdatePHP)
	api.Get("/php/:vhostId/ini",             h.GetPHPIni)
	api.Put("/php/:vhostId/ini",             h.UpdatePHPIni)
	api.Get("/php/:vhostId/opcache",         h.GetOPcacheStatus)
	api.Post("/php/:vhostId/opcache/reset",  h.ResetOPcache)

	// SSL CSR + custom import
	api.Post("/ssl/csr",    h.GenerateCSR)
	api.Post("/ssl/import", h.ImportCustomSSL)

	// Cron jobs
	api.Get("/cron",          h.ListCronJobs)
	api.Post("/cron",         h.CreateCronJob)
	api.Put("/cron/:id",      h.UpdateCronJob)
	api.Delete("/cron/:id",   h.DeleteCronJob)
	api.Post("/cron/:id/toggle", h.ToggleCronJob)

	// FTP accounts
	api.Get("/ftp",                  h.ListFTPAccounts)
	api.Post("/ftp",                 h.CreateFTPAccount)
	api.Put("/ftp/:id/password",     h.UpdateFTPPassword)
	api.Delete("/ftp/:id",           h.DeleteFTPAccount)
	api.Post("/ftp/:id/toggle",      h.ToggleFTPAccount)

	// Subdomains
	api.Get("/subdomains",        h.ListSubdomains)
	api.Post("/subdomains",       h.CreateSubdomain)
	api.Delete("/subdomains/:id", h.DeleteSubdomain)

	// Redirects
	api.Get("/redirects",        h.ListRedirects)
	api.Post("/redirects",       h.CreateRedirect)
	api.Delete("/redirects/:id", h.DeleteRedirect)

	// Error pages
	api.Get("/error-pages",  h.ListErrorPages)
	api.Post("/error-pages", h.UpsertErrorPage)

	// Directory privacy
	api.Get("/privacy",        h.ListDirectoryPrivacy)
	api.Post("/privacy",       h.CreateDirectoryPrivacy)
	api.Delete("/privacy/:id", h.DeleteDirectoryPrivacy)

	// SSH keys
	api.Get("/ssh-keys",        h.ListSSHKeys)
	api.Post("/ssh-keys",       h.AddSSHKey)
	api.Delete("/ssh-keys/:id", h.DeleteSSHKey)

	// MySQL remote access
	api.Get("/mysql-remote",        h.ListMySQLRemoteAccess)
	api.Post("/mysql-remote",       h.AddMySQLRemoteAccess)
	api.Delete("/mysql-remote/:id", h.DeleteMySQLRemoteAccess)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		cancel()
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutCancel()
		_ = app.ShutdownWithContext(shutCtx)
	}()
	log.Printf("WebServer service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil { log.Fatalf("listen: %v", err) }
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}
