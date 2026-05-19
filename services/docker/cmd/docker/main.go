package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/docker/internal/handler"
)

var version = "dev"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8095"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://xppanel:devpassword@localhost:5432/xppanel"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	h := handler.New(db)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel docker " + version,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "docker", "version": version})
	})

	api := app.Group("/api/v1")

	containers := api.Group("/docker/containers")
	containers.Get("/", h.ListContainers)
	containers.Post("/", h.CreateContainer)
	containers.Post("/:id/:action", h.ContainerAction)
	containers.Delete("/:id", h.DeleteContainer)
	containers.Get("/:id/logs", h.GetContainerLogs)

	images := api.Group("/docker/images")
	images.Get("/", h.ListImages)
	images.Post("/pull", h.PullImage)
	images.Delete("/:id", h.RemoveImage)

	compose := api.Group("/docker/compose")
	compose.Get("/", h.ListComposeProjects)
	compose.Post("/", h.CreateComposeProject)
	compose.Post("/:id/:action", h.ComposeAction)
	compose.Delete("/:id", h.DeleteComposeProject)

	log.Printf("docker service listening on :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
