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
	"github.com/xpanel/backup/internal/handler"
	"github.com/xpanel/backup/internal/storage"
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

	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "/var/backups/xppanel"
	}
	store := storage.NewLocalStorage(backupDir)
	bh := handler.NewBackupHandler(pool, store)

	app := fiber.New()
	app.Use(logger.New(), cors.New())

	v1 := app.Group("/api/v1")

	// Destinations
	v1.Get("/backups/destinations", bh.ListDestinations)
	v1.Post("/backups/destinations", bh.CreateDestination)
	v1.Delete("/backups/destinations/:id", bh.DeleteDestination)

	// Backups
	v1.Get("/backups", bh.ListBackups)
	v1.Post("/backups", bh.CreateBackup)
	v1.Delete("/backups/:id", bh.DeleteBackup)
	v1.Post("/backups/:id/restore", bh.RestoreBackup)

	// Schedules
	v1.Get("/backups/schedules", bh.ListSchedules)
	v1.Post("/backups/schedules", bh.CreateSchedule)
	v1.Delete("/backups/schedules/:id", bh.DeleteSchedule)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "backup"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8087"
	}
	log.Printf("Backup service running on :%s", port)
	log.Fatal(app.Listen(":" + port))
}

func runMigrations(db *sql.DB) {
	goose.SetTableName("backup_goose_migrations")
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
}
