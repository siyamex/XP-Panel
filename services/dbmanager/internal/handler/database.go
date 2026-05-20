package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/dbmanager/internal/domain"
	"github.com/xp-panel/xp-panel/services/dbmanager/internal/provider"
)

type DatabaseHandler struct {
	pool   *pgxpool.Pool
	pgProv *provider.PostgreSQLProvider
	myProv *provider.MySQLProvider
}

func NewDatabaseHandler(pool *pgxpool.Pool, pg *provider.PostgreSQLProvider, my *provider.MySQLProvider) *DatabaseHandler {
	return &DatabaseHandler{pool: pool, pgProv: pg, myProv: my}
}

// ── Databases ─────────────────────────────────────────────────────────────────

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
	if req.Name == "" || req.DBType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name and db_type are required"})
	}

	port := 5432
	if req.DBType == domain.DBTypeMySQL {
		port = 3306
	}

	var provErr error
	if req.DBType == domain.DBTypePostgreSQL && h.pgProv != nil {
		provErr = h.pgProv.CreateDatabase(c.Context(), req.Name, req.Password)
	} else if req.DBType == domain.DBTypeMySQL && h.myProv != nil {
		provErr = h.myProv.CreateDatabase(c.Context(), req.Name, req.Password)
	}
	if provErr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "provision failed: " + provErr.Error()})
	}

	var db domain.Database
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO database_instances (organization_id, name, db_type, db_name, host, port)
		 VALUES ($1, $2, $3, $4, 'localhost', $5)
		 RETURNING id, organization_id, name, db_type, db_name, host, port, status, size_mb, created_at, updated_at`,
		orgID, req.Name, req.DBType, req.Name, port,
	).Scan(&db.ID, &db.OrganizationID, &db.Name, &db.DBType, &db.DBName,
		&db.Host, &db.Port, &db.Status, &db.SizeMB, &db.CreatedAt, &db.UpdatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(db)
}

func (h *DatabaseHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")

	var dbType domain.DBType
	var dbName string
	err := h.pool.QueryRow(c.Context(),
		`DELETE FROM database_instances WHERE id = $1 AND organization_id = $2
		 RETURNING db_type, db_name`, id, orgID,
	).Scan(&dbType, &dbName)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "database not found"})
	}

	if dbType == domain.DBTypePostgreSQL && h.pgProv != nil {
		_ = h.pgProv.DropDatabase(c.Context(), dbName)
	} else if dbType == domain.DBTypeMySQL && h.myProv != nil {
		_ = h.myProv.DropDatabase(c.Context(), dbName)
	}

	return c.SendStatus(204)
}

// ── Database users (flat routes: /database-users) ────────────────────────────

func (h *DatabaseHandler) ListUsers(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, database_id, username, privileges, created_at
		 FROM database_users WHERE organization_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	users := []domain.DBUser{}
	for rows.Next() {
		var u domain.DBUser
		var privsJSON []byte
		if err := rows.Scan(&u.ID, &u.OrganizationID, &u.DatabaseID, &u.Username, &privsJSON, &u.CreatedAt); err != nil {
			continue
		}
		_ = json.Unmarshal(privsJSON, &u.Privileges)
		users = append(users, u)
	}
	return c.JSON(fiber.Map{"users": users, "total": len(users)})
}

func (h *DatabaseHandler) CreateUser(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")

	var req struct {
		DatabaseID string   `json:"database_id"`
		Username   string   `json:"username"`
		Password   string   `json:"password"`
		Privileges []string `json:"privileges"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Username == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "username and password are required"})
	}
	if len(req.Privileges) == 0 {
		req.Privileges = []string{"SELECT"}
	}

	// Look up which DB type to provision on
	if req.DatabaseID != "" {
		var dbType domain.DBType
		var dbName string
		err := h.pool.QueryRow(c.Context(),
			`SELECT db_type, db_name FROM database_instances WHERE id = $1`, req.DatabaseID,
		).Scan(&dbType, &dbName)
		if err == nil {
			if dbType == domain.DBTypePostgreSQL && h.pgProv != nil {
				_ = h.pgProv.CreateUser(c.Context(), dbName, req.Username, req.Password, req.Privileges)
			} else if dbType == domain.DBTypeMySQL && h.myProv != nil {
				_ = h.myProv.CreateUser(c.Context(), dbName, req.Username, req.Password, req.Privileges)
			}
		}
	}

	privsJSON, _ := json.Marshal(req.Privileges)

	var user domain.DBUser
	var rawPrivs []byte
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO database_users (organization_id, database_id, username, privileges)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, organization_id, database_id, username, privileges, created_at`,
		orgID, nullableStr(req.DatabaseID), req.Username, privsJSON,
	).Scan(&user.ID, &user.OrganizationID, &user.DatabaseID, &user.Username, &rawPrivs, &user.CreatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	_ = json.Unmarshal(rawPrivs, &user.Privileges)
	return c.Status(201).JSON(user)
}

func (h *DatabaseHandler) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")

	var username string
	err := h.pool.QueryRow(c.Context(),
		`DELETE FROM database_users WHERE id = $1 AND organization_id = $2 RETURNING username`,
		id, orgID,
	).Scan(&username)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	// Best-effort drop from both engines
	if h.pgProv != nil {
		_ = h.pgProv.DropUser(c.Context(), username)
	}

	return c.SendStatus(204)
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
