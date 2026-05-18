package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/dbmanager/internal/domain"
	"github.com/xpanel/dbmanager/internal/provider"
)

type DatabaseHandler struct {
	pool    *pgxpool.Pool
	pgProv  *provider.PostgreSQLProvider
	myProv  *provider.MySQLProvider
}

func NewDatabaseHandler(pool *pgxpool.Pool, pg *provider.PostgreSQLProvider, my *provider.MySQLProvider) *DatabaseHandler {
	return &DatabaseHandler{pool: pool, pgProv: pg, myProv: my}
}

func (h *DatabaseHandler) List(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, name, db_type, db_name, host, port, status, size_mb, created_at, updated_at
		 FROM database_instances WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	dbs := []domain.Database{}
	for rows.Next() {
		var db domain.Database
		if err := rows.Scan(&db.ID, &db.OrganizationID, &db.Name, &db.DBType, &db.DBName,
			&db.Host, &db.Port, &db.Status, &db.SizeMB, &db.CreatedAt, &db.UpdatedAt); err != nil {
			continue
		}
		dbs = append(dbs, db)
	}
	return c.JSON(fiber.Map{"databases": dbs, "total": len(dbs)})
}

func (h *DatabaseHandler) Create(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateDatabaseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	port := 5432
	if req.DBType == domain.DBTypeMySQL {
		port = 3306
	}

	dbName := req.Name

	// Provision in the actual DB engine
	var provErr error
	if req.DBType == domain.DBTypePostgreSQL && h.pgProv != nil {
		provErr = h.pgProv.CreateDatabase(c.Context(), dbName, req.Password)
	} else if req.DBType == domain.DBTypeMySQL && h.myProv != nil {
		provErr = h.myProv.CreateDatabase(c.Context(), dbName, req.Password)
	}
	if provErr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to provision database: " + provErr.Error()})
	}

	var db domain.Database
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO database_instances (organization_id, name, db_type, db_name, host, port)
		 VALUES ($1, $2, $3, $4, 'localhost', $5)
		 RETURNING id, organization_id, name, db_type, db_name, host, port, status, size_mb, created_at, updated_at`,
		orgID, req.Name, req.DBType, dbName, port,
	).Scan(&db.ID, &db.OrganizationID, &db.Name, &db.DBType, &db.DBName,
		&db.Host, &db.Port, &db.Status, &db.SizeMB, &db.CreatedAt, &db.UpdatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(db)
}

func (h *DatabaseHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	var db domain.Database
	err := h.pool.QueryRow(c.Context(),
		`DELETE FROM database_instances WHERE id = $1 RETURNING db_type, db_name`, id,
	).Scan(&db.DBType, &db.DBName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "database not found"})
	}

	if db.DBType == domain.DBTypePostgreSQL && h.pgProv != nil {
		_ = h.pgProv.DropDatabase(c.Context(), db.DBName)
	} else if db.DBType == domain.DBTypeMySQL && h.myProv != nil {
		_ = h.myProv.DropDatabase(c.Context(), db.DBName)
	}

	return c.SendStatus(204)
}

func (h *DatabaseHandler) ListUsers(c *fiber.Ctx) error {
	dbID := c.Params("id")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, database_id, username, privileges, created_at
		 FROM database_users WHERE database_id = $1 ORDER BY created_at DESC`, dbID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	users := []domain.DBUser{}
	for rows.Next() {
		var u domain.DBUser
		if err := rows.Scan(&u.ID, &u.OrganizationID, &u.DatabaseID, &u.Username, &u.Privileges, &u.CreatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}
	return c.JSON(fiber.Map{"users": users})
}

func (h *DatabaseHandler) CreateUser(c *fiber.Ctx) error {
	dbID := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	var req domain.CreateDBUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	var db domain.Database
	err := h.pool.QueryRow(c.Context(),
		`SELECT db_type, db_name FROM database_instances WHERE id = $1`, dbID,
	).Scan(&db.DBType, &db.DBName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "database not found"})
	}

	if db.DBType == domain.DBTypePostgreSQL && h.pgProv != nil {
		if err := h.pgProv.CreateUser(c.Context(), db.DBName, req.Username, req.Password, req.Privileges); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	} else if db.DBType == domain.DBTypeMySQL && h.myProv != nil {
		if err := h.myProv.CreateUser(c.Context(), db.DBName, req.Username, req.Password, req.Privileges); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	var user domain.DBUser
	err = h.pool.QueryRow(c.Context(),
		`INSERT INTO database_users (organization_id, database_id, username, privileges)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, organization_id, database_id, username, privileges, created_at`,
		orgID, dbID, req.Username, req.Privileges,
	).Scan(&user.ID, &user.OrganizationID, &user.DatabaseID, &user.Username, &user.Privileges, &user.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(user)
}

func (h *DatabaseHandler) DeleteUser(c *fiber.Ctx) error {
	dbID := c.Params("id")
	userID := c.Params("uid")

	var u domain.DBUser
	var dbType domain.DBType
	err := h.pool.QueryRow(c.Context(),
		`DELETE FROM database_users WHERE id = $1 AND database_id = $2 RETURNING username, (SELECT db_type FROM database_instances WHERE id = $2)`,
		userID, dbID,
	).Scan(&u.Username, &dbType)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	if dbType == domain.DBTypePostgreSQL && h.pgProv != nil {
		_ = h.pgProv.DropUser(c.Context(), u.Username)
	} else if dbType == domain.DBTypeMySQL && h.myProv != nil {
		_ = h.myProv.DropUser(c.Context(), u.Username)
	}

	return c.SendStatus(204)
}
