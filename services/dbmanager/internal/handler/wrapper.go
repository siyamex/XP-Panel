package handler

import "github.com/jackc/pgx/v5/pgxpool"
import "github.com/xp-panel/xp-panel/services/dbmanager/internal/provider"

func New(pool *pgxpool.Pool) *DatabaseHandler {
	pg := provider.NewPostgreSQLProvider("postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable")
	my := provider.NewMySQLProvider("xppanel:devpassword@tcp(localhost:3306)/")
	return NewDatabaseHandler(pool, pg, my)
}
