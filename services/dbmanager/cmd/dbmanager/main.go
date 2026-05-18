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
	"github.com/xpanel/dbmanager/internal/handler"
	"github.com/xpanel/dbmanager/internal/provider"
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

	pgProv := provider.NewPostgreSQLProvider(dsn)

	var myProv *provider.MySQLProvider
	if mysqlDSN := os.Getenv("MYSQL_DSN"); mysqlDSN != "" {
		myProv = provider.NewMySQLProvider(mysqlDSN)
	}

	dbHandler := handler.NewDatabaseHandler(pool, pgProv, myProv)

	app := fiber.New(fiber.Config{BodyLimit: 512 * 1024 * 1024})
	app.Use(logger.New(), cors.New())

	v1 := app.Group("/api/v1")
	v1.Get("/databases", dbHandler.List)
	v1.Post("/databases", dbHandler.Create)
	v1.Delete("/databases/:id", dbHandler.Delete)
	v1.Get("/databases/:id/users", dbHandler.ListUsers)
	v1.Post("/databases/:id/users", dbHandler.CreateUser)
	v1.Delete("/databases/:id/users/:uid", dbHandler.DeleteUser)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "dbmanager"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8086"
	}
	log.Printf("DBManager service running on :%s", port)
	log.Fatal(app.Listen(":" + port))
}

func runMigrations(db *sql.DB) {
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}
}
