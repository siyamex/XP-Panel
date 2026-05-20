package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/xpanel/marketplace/internal/crypto"
)

// WordPressInstaller installs WordPress via WP-CLI.
type WordPressInstaller struct{}

func (i *WordPressInstaller) Install(ctx context.Context, cfg Config) (*Result, error) {
	if err := mkdirAll(cfg.InstallPath); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}

	// Download WordPress core
	if err := shell(ctx, cfg.InstallPath, "wp", "core", "download",
		"--allow-root",
		"--path="+cfg.InstallPath,
	); err != nil {
		return nil, fmt.Errorf("wp core download: %w", err)
	}

	// Generate wp-config.php
	if cfg.DBPass == "" {
		cfg.DBPass = crypto.RandomPassword(24)
	}
	if err := shell(ctx, cfg.InstallPath, "wp", "config", "create",
		"--allow-root",
		"--dbname="+cfg.DBName,
		"--dbuser="+cfg.DBUser,
		"--dbpass="+cfg.DBPass,
		"--dbhost="+orDefault(cfg.DBHost, "localhost"),
		"--path="+cfg.InstallPath,
	); err != nil {
		return nil, fmt.Errorf("wp config create: %w", err)
	}

	// Run database install
	siteURL := "https://" + cfg.Domain
	if cfg.Domain == "" {
		siteURL = "http://localhost"
	}
	adminPass := cfg.AdminPass
	if adminPass == "" {
		adminPass = crypto.RandomPassword(20)
	}

	if err := shell(ctx, cfg.InstallPath, "wp", "core", "install",
		"--allow-root",
		"--url="+siteURL,
		"--title="+orDefault(cfg.SiteName, "My WordPress Site"),
		"--admin_user="+orDefault(cfg.AdminUser, "admin"),
		"--admin_password="+adminPass,
		"--admin_email="+orDefault(cfg.AdminEmail, "admin@example.com"),
		"--skip-email",
		"--path="+cfg.InstallPath,
	); err != nil {
		return nil, fmt.Errorf("wp core install: %w", err)
	}

	// Install popular plugins (security + caching)
	plugins := []string{"wordfence", "litespeed-cache"}
	for _, plugin := range plugins {
		_ = shell(ctx, cfg.InstallPath, "wp", "plugin", "install", plugin,
			"--allow-root", "--path="+cfg.InstallPath)
	}

	// Fix ownership to web server user
	_ = shell(ctx, cfg.InstallPath, "chown", "-R", "www-data:www-data", cfg.InstallPath)

	return &Result{
		AdminURL: siteURL + "/wp-admin",
		Notes:    fmt.Sprintf("WordPress installed. Admin: %s / Password: %s", orDefault(cfg.AdminUser, "admin"), adminPass),
	}, nil
}

func (i *WordPressInstaller) Uninstall(ctx context.Context, installPath string) error {
	// Deactivate all plugins first (best effort)
	_ = shell(ctx, installPath, "wp", "plugin", "deactivate", "--all", "--allow-root", "--path="+installPath)
	// Remove the directory
	return os.RemoveAll(installPath)
}

// writeHTAccess writes a WordPress-compatible .htaccess for Apache fallback.
func writeHTAccess(installPath string) error {
	content := `# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
`
	return writeFile(filepath.Join(installPath, ".htaccess"), content)
}

func orDefault(s, def string) string {
	if s != "" {
		return s
	}
	return def
}
