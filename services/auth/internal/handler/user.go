package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)


type UserHandler struct {
	db  *pgxpool.Pool
	jwt *service.JWTService
}

func NewUserHandler(db *pgxpool.Pool, jwt *service.JWTService) *UserHandler {
	return &UserHandler{db: db, jwt: jwt}
}

// GET /api/v1/auth/sessions
func (h *UserHandler) ListSessions(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}
	rows, err := h.db.Query(c.Context(),
		`SELECT id, ip_address, user_agent, created_at, last_active_at, expires_at
		 FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC`, claims.UserID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type sessionRow struct {
		ID           string  `json:"id"`
		IPAddress    *string `json:"ip_address"`
		UserAgent    *string `json:"user_agent"`
		CreatedAt    string  `json:"created_at"`
		LastActiveAt string  `json:"last_active_at"`
		ExpiresAt    string  `json:"expires_at"`
		IsCurrent    bool    `json:"is_current"`
	}

	var sessions []sessionRow
	for rows.Next() {
		var s sessionRow
		var id uuid.UUID
		if err := rows.Scan(&id, &s.IPAddress, &s.UserAgent, &s.CreatedAt, &s.LastActiveAt, &s.ExpiresAt); err != nil {
			continue
		}
		s.ID = id.String()
		s.IsCurrent = id == claims.SessionID
		sessions = append(sessions, s)
	}
	if sessions == nil {
		sessions = []sessionRow{}
	}
	return c.JSON(fiber.Map{"sessions": sessions})
}

// DELETE /api/v1/auth/sessions/:id
func (h *UserHandler) RevokeSession(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}
	sessionID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid session id")
	}

	// Ensure session belongs to this user
	ct, err := h.db.Exec(c.Context(),
		`DELETE FROM user_sessions WHERE id = $1 AND user_id = $2`, sessionID, claims.UserID)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "session not found"})
	}
	return c.SendStatus(204)
}

// DELETE /api/v1/auth/sessions
func (h *UserHandler) RevokeAllSessions(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}
	// Keep current session alive, revoke all others
	ct, err := h.db.Exec(c.Context(),
		`DELETE FROM user_sessions WHERE user_id = $1 AND id != $2`, claims.UserID, claims.SessionID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"revoked": ct.RowsAffected()})
}

// PATCH /api/v1/auth/me
func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}

	var body struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Timezone  string `json:"timezone"`
		Language  string `json:"language"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	_, err := h.db.Exec(c.Context(),
		`UPDATE users SET first_name=$1, last_name=$2, timezone=$3, language=$4, updated_at=NOW()
		 WHERE id=$5`,
		nullIfEmpty(body.FirstName), nullIfEmpty(body.LastName),
		body.Timezone, body.Language, claims.UserID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"updated": true})
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
