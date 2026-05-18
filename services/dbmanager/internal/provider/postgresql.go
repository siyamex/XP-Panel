package provider

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type PostgreSQLProvider struct {
	adminDSN string
}

func NewPostgreSQLProvider(dsn string) *PostgreSQLProvider {
	return &PostgreSQLProvider{adminDSN: dsn}
}

func (p *PostgreSQLProvider) CreateDatabase(ctx context.Context, dbName, password string) error {
	conn, err := pgx.Connect(ctx, p.adminDSN)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer conn.Close(ctx)

	// Create role/user and database
	_, err = conn.Exec(ctx, fmt.Sprintf(
		`CREATE USER %q WITH ENCRYPTED PASSWORD '%s'`, dbName, password,
	))
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}

	_, err = conn.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %q OWNER %q`, dbName, dbName))
	if err != nil {
		return fmt.Errorf("create database: %w", err)
	}

	return nil
}

func (p *PostgreSQLProvider) DropDatabase(ctx context.Context, dbName string) error {
	conn, err := pgx.Connect(ctx, p.adminDSN)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	// Terminate connections
	_, _ = conn.Exec(ctx, fmt.Sprintf(
		`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%s'`, dbName,
	))

	_, err = conn.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %q`, dbName))
	if err != nil {
		return err
	}
	_, err = conn.Exec(ctx, fmt.Sprintf(`DROP USER IF EXISTS %q`, dbName))
	return err
}

func (p *PostgreSQLProvider) CreateUser(ctx context.Context, dbName, username, password string, privileges []string) error {
	conn, err := pgx.Connect(ctx, p.adminDSN)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, fmt.Sprintf(
		`CREATE USER %q WITH ENCRYPTED PASSWORD '%s'`, username, password,
	))
	if err != nil {
		return err
	}

	_, err = conn.Exec(ctx, fmt.Sprintf(`GRANT ALL PRIVILEGES ON DATABASE %q TO %q`, dbName, username))
	return err
}

func (p *PostgreSQLProvider) DropUser(ctx context.Context, username string) error {
	conn, err := pgx.Connect(ctx, p.adminDSN)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, fmt.Sprintf(`DROP USER IF EXISTS %q`, username))
	return err
}

func (p *PostgreSQLProvider) GetDatabaseSize(ctx context.Context, dbName string) (int64, error) {
	conn, err := pgx.Connect(ctx, p.adminDSN)
	if err != nil {
		return 0, err
	}
	defer conn.Close(ctx)

	var sizeMB int64
	err = conn.QueryRow(ctx,
		`SELECT COALESCE(pg_database_size($1) / 1024 / 1024, 0)`, dbName,
	).Scan(&sizeMB)
	return sizeMB, err
}
