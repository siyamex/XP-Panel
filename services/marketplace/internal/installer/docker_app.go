package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DockerAppInstaller installs an app defined by a Docker Compose template.
type DockerAppInstaller struct {
	ComposeTemplate string // compose file content with {{.Domain}}, {{.AdminPass}} etc.
}

func (i *DockerAppInstaller) Install(ctx context.Context, cfg Config) (*Result, error) {
	if err := mkdirAll(cfg.InstallPath); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}

	// Render compose template
	compose := i.ComposeTemplate
	compose = strings.ReplaceAll(compose, "{{.Domain}}", cfg.Domain)
	compose = strings.ReplaceAll(compose, "{{.AdminUser}}", orDefault(cfg.AdminUser, "admin"))
	compose = strings.ReplaceAll(compose, "{{.AdminPass}}", cfg.AdminPass)
	compose = strings.ReplaceAll(compose, "{{.AdminEmail}}", orDefault(cfg.AdminEmail, "admin@example.com"))
	compose = strings.ReplaceAll(compose, "{{.SiteName}}", orDefault(cfg.SiteName, "App"))
	compose = strings.ReplaceAll(compose, "{{.DBName}}", cfg.DBName)
	compose = strings.ReplaceAll(compose, "{{.DBUser}}", cfg.DBUser)
	compose = strings.ReplaceAll(compose, "{{.DBPass}}", cfg.DBPass)
	compose = strings.ReplaceAll(compose, "{{.InstallPath}}", cfg.InstallPath)

	composePath := filepath.Join(cfg.InstallPath, "docker-compose.yml")
	if err := writeFile(composePath, compose); err != nil {
		return nil, fmt.Errorf("write compose: %w", err)
	}

	// Pull images first
	if err := shell(ctx, cfg.InstallPath, "docker", "compose", "pull"); err != nil {
		return nil, fmt.Errorf("docker compose pull: %w", err)
	}

	// Start services
	if err := shell(ctx, cfg.InstallPath, "docker", "compose", "up", "-d", "--remove-orphans"); err != nil {
		return nil, fmt.Errorf("docker compose up: %w", err)
	}

	siteURL := "https://" + cfg.Domain
	if cfg.Domain == "" {
		siteURL = "http://localhost"
	}

	return &Result{
		AdminURL: siteURL,
		Notes:    fmt.Sprintf("Docker app started in %s", cfg.InstallPath),
	}, nil
}

func (i *DockerAppInstaller) Uninstall(ctx context.Context, installPath string) error {
	// Stop and remove containers + volumes
	_ = shell(ctx, installPath, "docker", "compose", "down", "-v", "--remove-orphans")
	return os.RemoveAll(installPath)
}

// Built-in Docker Compose templates for common apps.

var GitLabTemplate = `version: "3.9"
services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    hostname: {{.Domain}}
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'https://{{.Domain}}'
        gitlab_rails['gitlab_email_from'] = '{{.AdminEmail}}'
        gitlab_rails['initial_root_password'] = '{{.AdminPass}}'
    ports:
      - "80"
      - "443"
      - "22"
    volumes:
      - {{.InstallPath}}/config:/etc/gitlab
      - {{.InstallPath}}/logs:/var/log/gitlab
      - {{.InstallPath}}/data:/var/opt/gitlab
    restart: unless-stopped
`

var NextcloudTemplate = `version: "3.9"
services:
  nextcloud:
    image: nextcloud:28-apache
    environment:
      MYSQL_HOST: db
      MYSQL_DATABASE: {{.DBName}}
      MYSQL_USER: {{.DBUser}}
      MYSQL_PASSWORD: {{.DBPass}}
      NEXTCLOUD_ADMIN_USER: {{.AdminUser}}
      NEXTCLOUD_ADMIN_PASSWORD: {{.AdminPass}}
      NEXTCLOUD_TRUSTED_DOMAINS: {{.Domain}}
    ports:
      - "80"
    volumes:
      - {{.InstallPath}}/data:/var/www/html
    depends_on: [db]
    restart: unless-stopped
  db:
    image: mariadb:11
    environment:
      MYSQL_ROOT_PASSWORD: {{.DBPass}}root
      MYSQL_DATABASE: {{.DBName}}
      MYSQL_USER: {{.DBUser}}
      MYSQL_PASSWORD: {{.DBPass}}
    volumes:
      - {{.InstallPath}}/db:/var/lib/mysql
    restart: unless-stopped
`

var GhostTemplate = `version: "3.9"
services:
  ghost:
    image: ghost:5-alpine
    environment:
      url: https://{{.Domain}}
      database__client: mysql
      database__connection__host: db
      database__connection__user: {{.DBUser}}
      database__connection__password: {{.DBPass}}
      database__connection__database: {{.DBName}}
      mail__transport: SMTP
    ports:
      - "2368"
    volumes:
      - {{.InstallPath}}/content:/var/lib/ghost/content
    depends_on: [db]
    restart: unless-stopped
  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: {{.DBPass}}root
      MYSQL_DATABASE: {{.DBName}}
      MYSQL_USER: {{.DBUser}}
      MYSQL_PASSWORD: {{.DBPass}}
    volumes:
      - {{.InstallPath}}/db:/var/lib/mysql
    restart: unless-stopped
`
