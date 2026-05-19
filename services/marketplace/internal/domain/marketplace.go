package domain

import "time"

type App struct {
	ID           string         `json:"id"`
	Slug         string         `json:"slug"`
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	Category     string         `json:"category"`
	IconURL      string         `json:"icon_url"`
	Version      string         `json:"version"`
	Author       string         `json:"author"`
	Homepage     string         `json:"homepage"`
	InstallCount int            `json:"install_count"`
	Rating       float64        `json:"rating"`
	Tags         []string       `json:"tags"`
	Requirements map[string]any `json:"requirements"`
	IsFeatured   bool           `json:"is_featured"`
	IsActive     bool           `json:"is_active"`
}

type Installation struct {
	ID             string         `json:"id"`
	OrganizationID string         `json:"organization_id"`
	AppID          string         `json:"app_id"`
	App            *App           `json:"app,omitempty"`
	DomainID       *string        `json:"domain_id"`
	InstallPath    string         `json:"install_path"`
	Status         string         `json:"status"`
	Version        string         `json:"version"`
	Config         map[string]any `json:"config"`
	InstalledAt    time.Time      `json:"installed_at"`
}

type InstallRequest struct {
	AppSlug     string `json:"app_slug"`
	DomainID    string `json:"domain_id"`
	InstallPath string `json:"install_path"`
	AdminUser   string `json:"admin_user"`
	AdminPass   string `json:"admin_pass"`
	AdminEmail  string `json:"admin_email"`
	SiteName    string `json:"site_name"`
}
