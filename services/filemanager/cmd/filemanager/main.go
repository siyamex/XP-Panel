package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/xp-panel/xp-panel/services/filemanager/internal/handler"
	"github.com/xp-panel/xp-panel/services/filemanager/internal/service"
)

func main() {
	port := env("PORT", "8085")
	rootDir := env("FILE_ROOT", "/var/www")

	fsSvc := service.NewFSService(rootDir)
	filesH := handler.NewFilesHandler(fsSvc)
	uploadH := handler.NewUploadHandler(fsSvc)
	archiveH := handler.NewArchiveHandler(fsSvc)

	app := fiber.New(fiber.Config{
		AppName:      "XP-Panel File Manager",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
		BodyLimit:    500 * 1024 * 1024, // 500MB upload limit
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "internal server error"
			if e, ok := err.(*fiber.Error); ok {
				code, msg = e.Code, e.Message
			}
			return c.Status(code).JSON(fiber.Map{"error": fiber.Map{"message": msg, "code": code}})
		},
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "filemanager"})
	})

	api := app.Group("/api/v1")
	files := api.Group("/files")

	// File operations
	files.Get("/list", filesH.List)
	files.Get("/read", filesH.Read)
	files.Put("/write", filesH.Write)
	files.Delete("/delete", filesH.Delete)
	files.Post("/mkdir", filesH.MkDir)
	files.Post("/copy", filesH.Copy)
	files.Post("/move", filesH.Move)
	files.Post("/rename", filesH.Rename)
	files.Get("/download", filesH.Download)
	files.Post("/newfile", filesH.NewFile)
	files.Put("/chmod", filesH.Chmod)
	files.Get("/search", filesH.Search)

	// Upload
	files.Post("/upload", uploadH.Upload)

	// Archive
	files.Post("/compress", archiveH.Compress)
	files.Post("/extract", archiveH.Extract)

	// SSH Terminal (WebSocket)
	api.Get("/terminal", handler.TerminalHTTPUpgrade, fiberws.New(handler.SSHTerminalWS))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		_ = app.ShutdownWithTimeout(5 * time.Second)
	}()

	log.Printf("filemanager service listening on :%s (root: %s)", port, rootDir)
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
