package handler

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ftpAccount struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	HomeDir   string    `json:"home_dir"`
	QuotaMB   int       `json:"quota_mb"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Handler) ListFTPAccounts(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, username, home_dir, quota_mb, enabled, created_at
		 FROM ftp_accounts WHERE org_id=$1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	accounts := []ftpAccount{}
	for rows.Next() {
		var a ftpAccount
		if err := rows.Scan(&a.ID, &a.Username, &a.HomeDir, &a.QuotaMB, &a.Enabled, &a.CreatedAt); err != nil {
			continue
		}
		accounts = append(accounts, a)
	}
	return c.JSON(fiber.Map{"accounts": accounts, "total": len(accounts)})
}

func (h *Handler) CreateFTPAccount(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "")
	userID := c.Get("X-User-ID", "")

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		HomeDir  string `json:"home_dir"`
		QuotaMB  int    `json:"quota_mb"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Username == "" || body.Password == "" || body.HomeDir == "" {
		return fiber.NewError(fiber.StatusBadRequest, "username, password, home_dir required")
	}

	// Simple SHA256 hash — production would use bcrypt
	h256 := sha256.Sum256([]byte(body.Password))
	hash := fmt.Sprintf("{SHA}%s", base64.StdEncoding.EncodeToString(h256[:]))

	var id string
	err := h.db.QueryRow(c.Context(),
		`INSERT INTO ftp_accounts (org_id, user_id, username, password_hash, home_dir, quota_mb)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		orgID, userID, body.Username, hash, body.HomeDir, body.QuotaMB).Scan(&id)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id})
}

func (h *Handler) UpdateFTPPassword(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")

	var body struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	h256 := sha256.Sum256([]byte(body.Password))
	hash := fmt.Sprintf("{SHA}%s", base64.StdEncoding.EncodeToString(h256[:]))
	_, err := h.db.Exec(c.Context(),
		`UPDATE ftp_accounts SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND org_id=$3`,
		hash, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteFTPAccount(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(), `DELETE FROM ftp_accounts WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) ToggleFTPAccount(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "")
	_, err := h.db.Exec(c.Context(),
		`UPDATE ftp_accounts SET enabled = NOT enabled, updated_at=NOW() WHERE id=$1 AND org_id=$2`, id, orgID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}
