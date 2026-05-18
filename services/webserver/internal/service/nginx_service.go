package service

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"text/template"
)

type NginxService struct {
	configDir   string
	templateDir string
	dryRun      bool
}

func NewNginxService(configDir, templateDir string, dryRun bool) *NginxService {
	return &NginxService{configDir: configDir, templateDir: templateDir, dryRun: dryRun}
}

type VHostTemplateData struct {
	Domain       string
	Aliases      []string
	DocumentRoot string
	PHPVersion   string
	SSLEnabled   bool
	SSLCertPath  string
	SSLKeyPath   string
	CustomConfig string
}

func (s *NginxService) WriteVHost(data VHostTemplateData) error {
	tmplPath := s.templateDir + "/nginx/vhost.tmpl"
	tmpl, err := template.ParseFiles(tmplPath)
	if err != nil {
		// Fallback: use embedded template string
		tmpl, err = template.New("vhost").Parse(embeddedNginxTemplate)
		if err != nil {
			return fmt.Errorf("parse nginx template: %w", err)
		}
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return fmt.Errorf("execute nginx template: %w", err)
	}

	if s.dryRun {
		return nil
	}

	configPath := fmt.Sprintf("%s/%s.conf", s.configDir, data.Domain)
	if err := os.WriteFile(configPath, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("write nginx config: %w", err)
	}

	return s.reload()
}

func (s *NginxService) RemoveVHost(domain string) error {
	if s.dryRun {
		return nil
	}
	configPath := fmt.Sprintf("%s/%s.conf", s.configDir, domain)
	if err := os.Remove(configPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return s.reload()
}

func (s *NginxService) reload() error {
	cmd := exec.Command("nginx", "-s", "reload")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("nginx reload: %w — %s", err, string(out))
	}
	return nil
}

// embeddedNginxTemplate is a minimal fallback when template files aren't available.
const embeddedNginxTemplate = `server {
    listen 80;
    server_name {{.Domain}};
    root {{.DocumentRoot}};
    index index.php index.html;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    {{if .PHPVersion}}
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php{{.PHPVersion}}-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
    {{end}}
}`
