package service

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type PHPService struct {
	poolDir string
	dryRun  bool
}

func NewPHPService(poolDir string, dryRun bool) *PHPService {
	return &PHPService{poolDir: poolDir, dryRun: dryRun}
}

type PHPPoolConfig struct {
	Domain         string
	PHPVersion     string
	MemoryLimit    string
	MaxExecTime    int
	UploadMaxSize  string
	PostMaxSize    string
	MaxInputVars   int
	OpcacheEnabled bool
}

func (s *PHPService) WritePool(cfg PHPPoolConfig) error {
	if cfg.MemoryLimit == "" {
		cfg.MemoryLimit = "256M"
	}
	if cfg.UploadMaxSize == "" {
		cfg.UploadMaxSize = "64M"
	}
	if cfg.PostMaxSize == "" {
		cfg.PostMaxSize = "64M"
	}
	if cfg.MaxExecTime == 0 {
		cfg.MaxExecTime = 300
	}

	socketPath := fmt.Sprintf("/run/php/php%s-fpm-%s.sock", cfg.PHPVersion, cfg.Domain)
	poolContent := fmt.Sprintf(`[%s]
user = www-data
group = www-data
listen = %s
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
php_admin_value[memory_limit] = %s
php_admin_value[upload_max_filesize] = %s
php_admin_value[post_max_size] = %s
php_admin_value[max_execution_time] = %d
php_admin_value[max_input_vars] = %d
`,
		cfg.Domain, socketPath,
		cfg.MemoryLimit, cfg.UploadMaxSize, cfg.PostMaxSize,
		cfg.MaxExecTime, cfg.MaxInputVars,
	)

	if cfg.OpcacheEnabled {
		poolContent += "php_admin_flag[opcache.enable] = on\n"
	}

	if s.dryRun {
		return nil
	}

	poolPath := fmt.Sprintf("%s/%s.conf", s.poolDir, cfg.Domain)
	if err := os.WriteFile(poolPath, []byte(poolContent), 0644); err != nil {
		return fmt.Errorf("write php pool: %w", err)
	}

	return s.reload(cfg.PHPVersion)
}

func (s *PHPService) RemovePool(domain, phpVersion string) error {
	if s.dryRun {
		return nil
	}
	poolPath := fmt.Sprintf("%s/%s.conf", s.poolDir, domain)
	if err := os.Remove(poolPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return s.reload(phpVersion)
}

func (s *PHPService) reload(phpVersion string) error {
	v := strings.ReplaceAll(phpVersion, ".", "")
	cmd := exec.Command("systemctl", "reload", fmt.Sprintf("php%s-fpm", v))
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("php-fpm reload: %w — %s", err, string(out))
	}
	return nil
}
