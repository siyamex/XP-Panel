package installer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/xpanel/marketplace/internal/crypto"
)

// LaravelInstaller installs a new Laravel application via Composer.
type LaravelInstaller struct{}

func (i *LaravelInstaller) Install(ctx context.Context, cfg Config) (*Result, error) {
	parent := filepath.Dir(cfg.InstallPath)
	appName := filepath.Base(cfg.InstallPath)

	if err := mkdirAll(parent); err != nil {
		return nil, fmt.Errorf("mkdir parent: %w", err)
	}

	// Create project via composer
	if err := shell(ctx, parent, "composer", "create-project",
		"--prefer-dist",
		"laravel/laravel",
		appName,
	); err != nil {
		return nil, fmt.Errorf("composer create-project: %w", err)
	}

	// Generate .env
	appKey, _ := generateLaravelKey()
	dbPass := cfg.DBPass
	if dbPass == "" {
		dbPass = crypto.RandomPassword(24)
	}

	env := buildEnv(map[string]string{
		"APP_NAME":    orDefault(cfg.SiteName, "Laravel"),
		"APP_ENV":     "production",
		"APP_KEY":     appKey,
		"APP_DEBUG":   "false",
		"APP_URL":     "https://" + cfg.Domain,
		"DB_CONNECTION": "mysql",
		"DB_HOST":     orDefault(cfg.DBHost, "127.0.0.1"),
		"DB_PORT":     "3306",
		"DB_DATABASE": cfg.DBName,
		"DB_USERNAME": cfg.DBUser,
		"DB_PASSWORD": dbPass,
	})
	if err := writeFile(filepath.Join(cfg.InstallPath, ".env"), env); err != nil {
		return nil, fmt.Errorf("write .env: %w", err)
	}

	// Run migrations
	if err := shell(ctx, cfg.InstallPath, "php", "artisan", "migrate", "--force"); err != nil {
		// Non-fatal — DB may not be ready
		_ = err
	}

	// Optimize for production
	_ = shell(ctx, cfg.InstallPath, "php", "artisan", "config:cache")
	_ = shell(ctx, cfg.InstallPath, "php", "artisan", "route:cache")
	_ = shell(ctx, cfg.InstallPath, "php", "artisan", "view:cache")

	// Fix storage permissions
	_ = shell(ctx, cfg.InstallPath, "chmod", "-R", "775", filepath.Join(cfg.InstallPath, "storage"))
	_ = shell(ctx, cfg.InstallPath, "chmod", "-R", "775", filepath.Join(cfg.InstallPath, "bootstrap/cache"))
	_ = shell(ctx, cfg.InstallPath, "chown", "-R", "www-data:www-data", cfg.InstallPath)

	siteURL := "https://" + cfg.Domain
	if cfg.Domain == "" {
		siteURL = "http://localhost"
	}

	return &Result{
		AdminURL: siteURL,
		Notes:    fmt.Sprintf("Laravel installed at %s. DB password: %s", cfg.InstallPath, dbPass),
	}, nil
}

func (i *LaravelInstaller) Uninstall(ctx context.Context, installPath string) error {
	return os.RemoveAll(installPath)
}

func generateLaravelKey() (string, error) {
	key := crypto.RandomBytes(32)
	return "base64:" + key, nil
}

func buildEnv(vars map[string]string) string {
	var sb strings.Builder
	for k, v := range vars {
		sb.WriteString(k + "=" + v + "\n")
	}
	return sb.String()
}
