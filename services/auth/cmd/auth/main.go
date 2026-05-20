package main

import (
	"context"
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
	"github.com/redis/go-redis/v9"
	"github.com/xp-panel/xp-panel/services/auth/internal/handler"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

var version = "dev"

func main() {
	cfg := loadConfig()

	// ── Database ─────────────────────────────────────────────────────────────
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to postgres: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("postgres ping failed: %v", err)
	}

	// ── Redis ─────────────────────────────────────────────────────────────────
	rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("redis ping failed: %v", err)
	}
	defer rdb.Close()

	// ── Services ─────────────────────────────────────────────────────────────
	jwtSvc := service.NewJWTService(cfg.JWTSecret, cfg.AccessExpiry, cfg.RefreshExpiry)
	mfaRepo := newMFARepo(pool)
	mfaSvc := service.NewMFAService(mfaRepo, "XP-Panel")

	userRepo := newUserRepo(pool)
	orgRepo := newOrgRepo(pool)
	sessionRepo := newSessionRepo(pool, rdb)
	authSvc := service.NewAuthService(userRepo, orgRepo, sessionRepo, jwtSvc, mfaSvc)

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := handler.NewAuthHandler(authSvc, jwtSvc)
	mfaHandler := handler.NewMFAHandler(mfaSvc, jwtSvc)
	oauthHandler := handler.NewOAuthHandler(authSvc, jwtSvc, rdb)
	userHandler := handler.NewUserHandler(pool, jwtSvc)

	rpID := os.Getenv("WEBAUTHN_RP_ID")
	if rpID == "" { rpID = "localhost" }
	rpOrigin := os.Getenv("WEBAUTHN_RP_ORIGIN")
	if rpOrigin == "" { rpOrigin = "http://localhost:3000" }
	passkeyHandler := handler.NewPasskeyHandler(pool, rpID, rpOrigin)

	// ── Fiber app ─────────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:           "XP-Panel Auth Service " + version,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorHandler:      errorHandler,
		DisableKeepalive:  false,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.AllowOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// ── Routes ────────────────────────────────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "version": version})
	})

	v1 := app.Group("/api/v1/auth")

	// Public routes
	v1.Post("/register", authHandler.Register)
	v1.Post("/login", authHandler.Login)
	v1.Post("/refresh", authHandler.Refresh)
	v1.Post("/mfa/verify", mfaHandler.Verify)

	// OAuth routes
	v1.Get("/oauth/:provider", oauthHandler.Redirect)
	v1.Get("/oauth/:provider/callback", oauthHandler.Callback)

	// Authenticated routes
	auth := v1.Use(jwtMiddleware(jwtSvc))
	auth.Post("/logout", authHandler.Logout)
	auth.Get("/me", authHandler.Me)
	auth.Patch("/me", userHandler.UpdateProfile)
	auth.Post("/mfa/totp/setup", mfaHandler.SetupTOTP)
	auth.Post("/mfa/totp/confirm", mfaHandler.ConfirmTOTP)
	auth.Post("/mfa/disable", mfaHandler.Disable)
	auth.Get("/sessions", userHandler.ListSessions)
	auth.Delete("/sessions/:id", userHandler.RevokeSession)
	auth.Delete("/sessions", userHandler.RevokeAllSessions)

	// Passkeys / WebAuthn (authenticated)
	auth.Get("/passkeys", passkeyHandler.ListPasskeys)
	auth.Delete("/passkeys/:id", passkeyHandler.DeletePasskey)
	auth.Get("/passkeys/register/begin", passkeyHandler.BeginRegistration)
	auth.Post("/passkeys/register/finish", passkeyHandler.FinishRegistration)

	// Passkey authentication (public — no JWT yet)
	v1.Post("/passkeys/authenticate/begin", passkeyHandler.BeginAuthentication)
	v1.Post("/passkeys/authenticate/finish", passkeyHandler.FinishAuthentication)

	// ── Start / graceful shutdown ─────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		addr := ":" + cfg.Port
		log.Printf("Auth service listening on %s (version=%s)", addr, version)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down auth service...")
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
		"error": fiber.Map{
			"message": msg,
			"code":    code,
		},
	})
}

func jwtMiddleware(jwtSvc *service.JWTService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			return fiber.NewError(fiber.StatusUnauthorized, "missing or invalid authorization header")
		}

		claims, err := jwtSvc.ParseToken(authHeader[7:])
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		c.Locals("claims", claims)
		return c.Next()
	}
}
