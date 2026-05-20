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
	// Test config first to avoid reloading with a broken config
	if out, err := exec.Command("nginx", "-t").CombinedOutput(); err != nil {
		return fmt.Errorf("nginx config test failed: %w — %s", err, string(out))
	}
	if out, err := exec.Command("nginx", "-s", "reload").CombinedOutput(); err != nil {
		return fmt.Errorf("nginx reload: %w — %s", err, string(out))
	}
	return nil
}

// embeddedNginxTemplate is the production nginx vhost template.
const embeddedNginxTemplate = `{{if .SSLEnabled}}
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name {{.Domain}}{{range .Aliases}} {{.}}{{end}};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name {{.Domain}}{{range .Aliases}} {{.}}{{end}};

    ssl_certificate     {{.SSLCertPath}};
    ssl_certificate_key {{.SSLKeyPath}};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    root  {{.DocumentRoot}};
    index index.php index.html index.htm;

    access_log /var/log/nginx/{{.Domain}}.access.log combined;
    error_log  /var/log/nginx/{{.Domain}}.error.log warn;

    gzip on;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2?|ttf|svg|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
    {{if .PHPVersion}}
    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php{{.PHPVersion}}-fpm-{{.Domain}}.sock;
        fastcgi_index index.php;
        fastcgi_read_timeout 300;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_param HTTP_PROXY "";
    }
    {{end}}
    location ~ /\.(?!well-known) { deny all; }
    {{if .CustomConfig}}{{.CustomConfig}}{{end}}
}
{{else}}
server {
    listen 80;
    listen [::]:80;
    server_name {{.Domain}}{{range .Aliases}} {{.}}{{end}};

    root  {{.DocumentRoot}};
    index index.php index.html index.htm;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    access_log /var/log/nginx/{{.Domain}}.access.log combined;
    error_log  /var/log/nginx/{{.Domain}}.error.log warn;

    gzip on;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2?|ttf|svg|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
    {{if .PHPVersion}}
    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass unix:/run/php/php{{.PHPVersion}}-fpm-{{.Domain}}.sock;
        fastcgi_index index.php;
        fastcgi_read_timeout 300;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_param HTTP_PROXY "";
    }
    {{end}}
    location ~ /\.(?!well-known) { deny all; }
    {{if .CustomConfig}}{{.CustomConfig}}{{end}}
}
{{end}}`
