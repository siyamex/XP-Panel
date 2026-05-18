package provider

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"
)

type MySQLProvider struct {
	adminDSN string
}

func NewMySQLProvider(dsn string) *MySQLProvider {
	return &MySQLProvider{adminDSN: dsn}
}

func (p *MySQLProvider) db() (*sql.DB, error) {
	return sql.Open("mysql", p.adminDSN)
}

func (p *MySQLProvider) CreateDatabase(ctx context.Context, dbName, password string) error {
	db, err := p.db()
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`", dbName))
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, fmt.Sprintf(
		"CREATE USER IF NOT EXISTS '%s'@'%%' IDENTIFIED BY '%s'", dbName, password,
	))
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, fmt.Sprintf(
		"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'%%'", dbName, dbName,
	))
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, "FLUSH PRIVILEGES")
	return err
}

func (p *MySQLProvider) DropDatabase(ctx context.Context, dbName string) error {
	db, err := p.db()
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.ExecContext(ctx, fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", dbName))
	if err != nil {
		return err
	}

	_, _ = db.ExecContext(ctx, fmt.Sprintf("DROP USER IF EXISTS '%s'@'%%'", dbName))
	_, _ = db.ExecContext(ctx, "FLUSH PRIVILEGES")
	return nil
}

func (p *MySQLProvider) CreateUser(ctx context.Context, dbName, username, password string, privileges []string) error {
	db, err := p.db()
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.ExecContext(ctx, fmt.Sprintf(
		"CREATE USER IF NOT EXISTS '%s'@'%%' IDENTIFIED BY '%s'", username, password,
	))
	if err != nil {
		return err
	}

	priv := "ALL PRIVILEGES"
	if len(privileges) > 0 {
		priv = privileges[0]
		for _, p := range privileges[1:] {
			priv += ", " + p
		}
	}

	_, err = db.ExecContext(ctx, fmt.Sprintf(
		"GRANT %s ON `%s`.* TO '%s'@'%%'", priv, dbName, username,
	))
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, "FLUSH PRIVILEGES")
	return err
}

func (p *MySQLProvider) DropUser(ctx context.Context, username string) error {
	db, err := p.db()
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.ExecContext(ctx, fmt.Sprintf("DROP USER IF EXISTS '%s'@'%%'", username))
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, "FLUSH PRIVILEGES")
	return err
}

func (p *MySQLProvider) GetDatabaseSize(ctx context.Context, dbName string) (int64, error) {
	db, err := p.db()
	if err != nil {
		return 0, err
	}
	defer db.Close()

	var sizeMB int64
	err = db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(data_length + index_length) / 1024 / 1024, 0)
		FROM information_schema.tables
		WHERE table_schema = ?`, dbName,
	).Scan(&sizeMB)
	return sizeMB, err
}
