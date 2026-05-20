package installer

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Config holds the common fields for any app installation.
type Config struct {
	InstallPath string
	Domain      string
	AdminUser   string
	AdminEmail  string
	AdminPass   string
	SiteName    string
	DBName      string
	DBUser      string
	DBPass      string
	DBHost      string
	Extra       map[string]string
}

// Result is returned after a successful install.
type Result struct {
	AdminURL string
	Notes    string
}

// Installer is the interface all app installers implement.
type Installer interface {
	Install(ctx context.Context, cfg Config) (*Result, error)
	Uninstall(ctx context.Context, installPath string) error
}

// shell runs a shell command in a given directory.
func shell(ctx context.Context, dir, cmd string, args ...string) error {
	c := exec.CommandContext(ctx, cmd, args...)
	c.Dir = dir
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	if err := c.Run(); err != nil {
		return fmt.Errorf("%s %v: %w", cmd, args, err)
	}
	return nil
}

// mkdirAll ensures the install path exists.
func mkdirAll(path string) error {
	return os.MkdirAll(path, 0755)
}

// writeFile writes content to path, creating parent dirs as needed.
func writeFile(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0644)
}
