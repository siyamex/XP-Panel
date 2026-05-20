package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/redis/go-redis/v9"
	"github.com/xp-panel/xp-panel/services/gateway/internal/middleware"
	"github.com/xp-panel/xp-panel/services/gateway/internal/proxy"
)

var version = "dev"

func main() {
	cfg := loadConfig()

	// ── Redis (for rate limiting) ─────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("redis ping failed: %v", err)
	}
	defer rdb.Close()

	prx := proxy.New()

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel Gateway " + version,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
		BodyLimit:    500 * 1024 * 1024, // 500MB for file uploads
		ErrorHandler: errorHandler,
	})

	// ── Global middleware ─────────────────────────────────────────────────────
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} | ${status} | ${latency} | ${ip} | ${method} ${path}\n",
	}))
	app.Use(compress.New(compress.Config{Level: compress.LevelBestSpeed}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Request-ID",
		AllowMethods:     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// ── Health check ──────────────────────────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "version": version, "service": "gateway"})
	})

	// ── Rate limit on auth endpoints (strict) ─────────────────────────────────
	authRL := middleware.RateLimit(rdb, 20, time.Minute, middleware.IPKey)

	// ── Public auth routes (no JWT required) ──────────────────────────────────
	app.Post("/api/v1/auth/register", authRL, prx.To(cfg.AuthURL))
	app.Post("/api/v1/auth/login", authRL, prx.To(cfg.AuthURL))
	app.Post("/api/v1/auth/refresh", authRL, prx.To(cfg.AuthURL))
	app.Post("/api/v1/auth/mfa/verify", authRL, prx.To(cfg.AuthURL))
	app.Get("/api/v1/auth/oauth2/:provider", prx.To(cfg.AuthURL))
	app.Get("/api/v1/auth/oauth2/:provider/callback", prx.To(cfg.AuthURL))

	// ── Authenticated routes ──────────────────────────────────────────────────
	jwtAuth := middleware.JWTAuth(cfg.JWTSecret)
	tenant := middleware.TenantIsolation()
	apiRL := middleware.RateLimit(rdb, 1000, time.Minute, middleware.UserKey)

	authenticated := app.Group("/api/v1", jwtAuth, tenant, apiRL)

	// Auth service
	authenticated.All("/auth/*", prx.To(cfg.AuthURL))

	// DNS service
	authenticated.All("/dns/*", middleware.RequirePerm("dns:read"), prx.To(cfg.DNSServiceURL))

	// Mail service
	authenticated.All("/mail/*", middleware.RequirePerm("mail:read"), prx.To(cfg.MailServiceURL))

	// Domains service
	authenticated.Get("/domains", middleware.RequirePerm("domains:read"), prx.To(cfg.DomainsURL))
	authenticated.Get("/domains/*", middleware.RequirePerm("domains:read"), prx.To(cfg.DomainsURL))
	authenticated.Post("/domains", middleware.RequirePerm("domains:write"), prx.To(cfg.DomainsURL))
	authenticated.Post("/domains/*", middleware.RequirePerm("domains:write"), prx.To(cfg.DomainsURL))
	authenticated.Delete("/domains/*", middleware.RequirePerm("domains:delete"), prx.To(cfg.DomainsURL))

	// Web server
	authenticated.All("/webserver/*", middleware.RequirePerm("domains:write"), prx.To(cfg.WebServerURL))

	// File manager
	authenticated.All("/files/*", middleware.RequirePerm("files:read"), prx.To(cfg.FileManagerURL))

	// Database manager
	authenticated.All("/databases*", middleware.RequirePerm("db:read"), prx.To(cfg.DBManagerURL))
	authenticated.All("/database-users*", middleware.RequirePerm("db:read"), prx.To(cfg.DBManagerURL))

	// Backup
	authenticated.All("/backups*", middleware.RequirePerm("backup:read"), prx.To(cfg.BackupURL))

	// Monitoring
	authenticated.All("/monitoring/*", middleware.RequirePerm("monitoring:read"), prx.To(cfg.MonitoringURL))

	// Billing
	authenticated.All("/billing/*", middleware.RequirePerm("billing:read"), prx.To(cfg.BillingURL))

	// AI assistant (SSE streaming)
	authenticated.Get("/ai/chat", middleware.RequirePerm("ai:use"), prx.SSETo(cfg.AIURL))
	authenticated.All("/ai/*", middleware.RequirePerm("ai:use"), prx.To(cfg.AIURL))

	// Security
	authenticated.All("/security/*", middleware.RequirePerm("security:read"), prx.To(cfg.SecurityURL))

	// Docker management
	authenticated.All("/docker/*", middleware.RequirePerm("docker:read"), prx.To(cfg.DockerURL))

	// DevOps / pipelines (SSE for live logs)
	authenticated.Get("/devops/deployments/:id/logs", middleware.RequirePerm("devops:read"), prx.SSETo(cfg.DevOpsURL))
	authenticated.All("/devops/*", middleware.RequirePerm("devops:read"), prx.To(cfg.DevOpsURL))

	// Marketplace
	authenticated.All("/marketplace/*", middleware.RequirePerm("marketplace:read"), prx.To(cfg.MarketplaceURL))

	// Notifications
	authenticated.All("/notifications*", jwtAuth, prx.To(cfg.NotificationURL))

	// Admin routes
	authenticated.All("/admin/*", middleware.RequireRole("admin", "super_admin"), prx.To(cfg.AuthURL))

	// Agent ingest — authenticated by X-Agent-Key inside monitoring service, not JWT
	app.Post("/api/v1/agent/metrics", prx.To(cfg.MonitoringURL))

	// Passkey authentication (public — no JWT)
	app.Post("/api/v1/auth/passkeys/authenticate/begin", authRL, prx.To(cfg.AuthURL))
	app.Post("/api/v1/auth/passkeys/authenticate/finish", authRL, prx.To(cfg.AuthURL))

	// ── WebSocket routes ──────────────────────────────────────────────────────
	app.Get("/ws/metrics/:serverId", jwtAuth, prx.To(cfg.MonitoringURL))
	app.Get("/ws/logs/:deploymentId", jwtAuth, prx.To(cfg.DevOpsURL))
	app.Get("/ws/notifications", jwtAuth, prx.To(cfg.NotificationURL))

	// ── GraphQL ───────────────────────────────────────────────────────────────
	app.All("/graphql", jwtAuth, prx.To(cfg.AuthURL))

	// ── Start / graceful shutdown ─────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		addr := ":" + cfg.Port
		log.Printf("Gateway listening on %s (version=%s)", addr, version)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("gateway error: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "internal server error"
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}
	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{"message": msg, "code": code},
	})
}
