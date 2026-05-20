package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/marketplace/internal/crypto"
	"github.com/xpanel/marketplace/internal/domain"
	"github.com/xpanel/marketplace/internal/installer"
)

type MarketplaceHandler struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *MarketplaceHandler {
	return &MarketplaceHandler{db: db}
}

func (h *MarketplaceHandler) installerFor(slug string) installer.Installer {
	switch slug {
	case "wordpress":
		return &installer.WordPressInstaller{}
	case "laravel":
		return &installer.LaravelInstaller{}
	case "nextcloud":
		return &installer.DockerAppInstaller{ComposeTemplate: installer.NextcloudTemplate}
	case "ghost":
		return &installer.DockerAppInstaller{ComposeTemplate: installer.GhostTemplate}
	case "gitlab":
		return &installer.DockerAppInstaller{ComposeTemplate: installer.GitLabTemplate}
	default:
		return nil
	}
}

func (h *MarketplaceHandler) ListApps(c *fiber.Ctx) error {
	category := c.Query("category")
	search := c.Query("q")
	featured := c.QueryBool("featured")

	query := `SELECT id, slug, name, description, category, icon_url, version, author, install_count, rating, tags, is_featured
	          FROM marketplace_apps WHERE is_active=TRUE`
	args := []any{}
	n := 1

	if category != "" {
		query += fmt.Sprintf(` AND category=$%d`, n)
		args = append(args, category)
		n++
	}
	if search != "" {
		query += fmt.Sprintf(` AND (name ILIKE $%d OR description ILIKE $%d)`, n, n)
		args = append(args, "%"+search+"%")
		n++
	}
	if featured {
		query += ` AND is_featured=TRUE`
	}
	query += ` ORDER BY is_featured DESC, install_count DESC`

	rows, err := h.db.Query(c.Context(), query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	apps := []domain.App{}
	for rows.Next() {
		var app domain.App
		var tagsJSON []byte
		if err := rows.Scan(&app.ID, &app.Slug, &app.Name, &app.Description, &app.Category,
			&app.IconURL, &app.Version, &app.Author, &app.InstallCount, &app.Rating, &tagsJSON, &app.IsFeatured); err != nil {
			continue
		}
		_ = json.Unmarshal(tagsJSON, &app.Tags)
		apps = append(apps, app)
	}
	return c.JSON(fiber.Map{"apps": apps, "total": len(apps)})
}

func (h *MarketplaceHandler) GetApp(c *fiber.Ctx) error {
	slug := c.Params("slug")
	var app domain.App
	var tagsJSON, reqJSON []byte
	err := h.db.QueryRow(c.Context(),
		`SELECT id, slug, name, description, category, icon_url, version, author, homepage, install_count, rating, tags, requirements, is_featured
		 FROM marketplace_apps WHERE slug=$1 AND is_active=TRUE`, slug).
		Scan(&app.ID, &app.Slug, &app.Name, &app.Description, &app.Category, &app.IconURL,
			&app.Version, &app.Author, &app.Homepage, &app.InstallCount, &app.Rating, &tagsJSON, &reqJSON, &app.IsFeatured)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "app not found"})
	}
	_ = json.Unmarshal(tagsJSON, &app.Tags)
	_ = json.Unmarshal(reqJSON, &app.Requirements)
	return c.JSON(app)
}

func (h *MarketplaceHandler) InstallApp(c *fiber.Ctx) error {
	var req domain.InstallRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.AppSlug == "" {
		return c.Status(400).JSON(fiber.Map{"error": "app_slug is required"})
	}
	orgID := c.Get("X-Org-ID", "default")

	var appID string
	err := h.db.QueryRow(c.Context(), `SELECT id FROM marketplace_apps WHERE slug=$1 AND is_active=TRUE`, req.AppSlug).Scan(&appID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "app not found"})
	}

	installPath := req.InstallPath
	if installPath == "" {
		installPath = "/var/www/" + req.AppSlug
	}
	if req.AdminPass == "" {
		req.AdminPass = crypto.RandomPassword(20)
	}

	configJSON, _ := json.Marshal(map[string]string{
		"admin_user":  req.AdminUser,
		"admin_email": req.AdminEmail,
		"site_name":   req.SiteName,
		"admin_pass":  req.AdminPass,
	})

	var domainID *string
	if req.DomainID != "" {
		domainID = &req.DomainID
	}

	var id string
	err = h.db.QueryRow(c.Context(),
		`INSERT INTO app_installations (organization_id, app_id, domain_id, install_path, status, config)
		 VALUES ($1,$2,$3,$4,'installing',$5) RETURNING id`,
		orgID, appID, domainID, installPath, configJSON,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	_, _ = h.db.Exec(c.Context(), `UPDATE marketplace_apps SET install_count=install_count+1 WHERE id=$1`, appID)

	// Run installer asynchronously
	inst := h.installerFor(req.AppSlug)
	if inst != nil {
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 15*60*1e9) // 15 min
			defer cancel()

			cfg := installer.Config{
				InstallPath: installPath,
				Domain:      req.Domain,
				AdminUser:   req.AdminUser,
				AdminEmail:  req.AdminEmail,
				AdminPass:   req.AdminPass,
				SiteName:    req.SiteName,
				DBName:      req.DBName,
				DBUser:      req.DBUser,
				DBPass:      req.DBPass,
				DBHost:      req.DBHost,
			}

			result, err := inst.Install(bgCtx, cfg)
			if err != nil {
				log.Printf("install %s failed: %v", req.AppSlug, err)
				_, _ = h.db.Exec(bgCtx,
					`UPDATE app_installations SET status='failed', error_message=$1 WHERE id=$2`,
					err.Error(), id)
				return
			}

			notesJSON, _ := json.Marshal(result)
			_, _ = h.db.Exec(bgCtx,
				`UPDATE app_installations SET status='active', notes=$1, admin_url=$2 WHERE id=$3`,
				string(notesJSON), result.AdminURL, id)
			log.Printf("installed %s at %s → %s", req.AppSlug, installPath, result.AdminURL)
		}()
	} else {
		// No real installer — mark active immediately (generic apps)
		_, _ = h.db.Exec(c.Context(), `UPDATE app_installations SET status='active' WHERE id=$1`, id)
	}

	return c.Status(201).JSON(fiber.Map{
		"id":           id,
		"status":       "installing",
		"install_path": installPath,
		"message":      fmt.Sprintf("%s installation started. Check status for progress.", req.AppSlug),
	})
}

func (h *MarketplaceHandler) GetInstallation(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")

	var inst domain.Installation
	var app domain.App
	var adminURL, errMsg *string
	err := h.db.QueryRow(c.Context(),
		`SELECT i.id, i.install_path, i.status, i.admin_url, i.error_message, i.installed_at,
		        a.slug, a.name, a.category, a.version
		 FROM app_installations i JOIN marketplace_apps a ON a.id=i.app_id
		 WHERE i.id=$1 AND i.organization_id=$2`, id, orgID).
		Scan(&inst.ID, &inst.InstallPath, &inst.Status, &adminURL, &errMsg, &inst.InstalledAt,
			&app.Slug, &app.Name, &app.Category, &app.Version)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "installation not found"})
	}
	inst.App = &app
	inst.OrganizationID = orgID
	result := fiber.Map{
		"installation": inst,
		"admin_url":    adminURL,
		"error":        errMsg,
	}
	return c.JSON(result)
}

func (h *MarketplaceHandler) ListInstallations(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT i.id, i.app_id, i.install_path, i.status, i.installed_at,
		        a.slug, a.name, a.category, a.version
		 FROM app_installations i JOIN marketplace_apps a ON a.id=i.app_id
		 WHERE i.organization_id=$1 AND i.status != 'removed' ORDER BY i.installed_at DESC`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	installs := []domain.Installation{}
	for rows.Next() {
		var inst domain.Installation
		var app domain.App
		if err := rows.Scan(&inst.ID, &inst.AppID, &inst.InstallPath, &inst.Status, &inst.InstalledAt,
			&app.Slug, &app.Name, &app.Category, &app.Version); err != nil {
			continue
		}
		inst.App = &app
		inst.OrganizationID = orgID
		installs = append(installs, inst)
	}
	return c.JSON(fiber.Map{"installations": installs, "total": len(installs)})
}

func (h *MarketplaceHandler) UninstallApp(c *fiber.Ctx) error {
	id := c.Params("id")
	orgID := c.Get("X-Org-ID", "default")
	ct, err := h.db.Exec(c.Context(),
		`UPDATE app_installations SET status='removed', updated_at=NOW() WHERE id=$1 AND organization_id=$2`, id, orgID)
	if err != nil || ct.RowsAffected() == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "installation not found"})
	}
	return c.SendStatus(204)
}
