package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/xpanel/devops/internal/handler"
)

var version = "dev"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8093"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://xppanel:devpassword@localhost:5432/xppanel"
	}

	sqlDB, err := sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	goose.SetTableName("devops_goose_migrations")
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
		AppName:      "XP-Panel devops " + version,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "devops", "version": version})
	})

	api := app.Group("/api/v1")

	pipelines := api.Group("/devops/pipelines")
	pipelines.Get("/", h.ListPipelines)
	pipelines.Post("/", h.CreatePipeline)
	pipelines.Get("/:id", h.GetPipeline)
	pipelines.Put("/:id", h.UpdatePipeline)
	pipelines.Delete("/:id", h.DeletePipeline)
	pipelines.Post("/:id/run", h.TriggerRun)
	pipelines.Get("/:id/runs", h.ListRuns)

	api.Get("/devops/deployments", h.ListDeployments)

	log.Printf("devops service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
