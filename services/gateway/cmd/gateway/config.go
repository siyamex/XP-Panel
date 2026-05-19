package main

import "os"

type Config struct {
	Port            string
	RedisAddr       string
	JWTSecret       string
	AllowOrigins    string
	AuthURL         string
	DomainsURL      string
	DNSServiceURL   string
	MailServiceURL  string
	WebServerURL    string
	FileManagerURL  string
	DBManagerURL    string
	BackupURL       string
	MonitoringURL   string
	BillingURL      string
	AIURL           string
	SecurityURL     string
	MarketplaceURL  string
	DevOpsURL       string
	NotificationURL string
}

func loadConfig() Config {
	return Config{
		Port:            getEnv("PORT", "8080"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:       getEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
		AllowOrigins:    getEnv("CORS_ORIGINS", "http://localhost:3000"),
		AuthURL:         getEnv("AUTH_SERVICE_URL", "http://localhost:8081"),
		DomainsURL:      getEnv("DOMAINS_SERVICE_URL", "http://localhost:8095"),
		DNSServiceURL:   getEnv("DNS_SERVICE_URL", "http://localhost:8082"),
		MailServiceURL:  getEnv("MAIL_SERVICE_URL", "http://localhost:8083"),
		WebServerURL:    getEnv("WEBSERVER_SERVICE_URL", "http://localhost:8084"),
		FileManagerURL:  getEnv("FILEMANAGER_SERVICE_URL", "http://localhost:8085"),
		DBManagerURL:    getEnv("DBMANAGER_SERVICE_URL", "http://localhost:8086"),
		BackupURL:       getEnv("BACKUP_SERVICE_URL", "http://localhost:8087"),
		MonitoringURL:   getEnv("MONITORING_SERVICE_URL", "http://localhost:8088"),
		BillingURL:      getEnv("BILLING_SERVICE_URL", "http://localhost:8089"),
		AIURL:           getEnv("AI_SERVICE_URL", "http://localhost:8090"),
		SecurityURL:     getEnv("SECURITY_SERVICE_URL", "http://localhost:8091"),
		MarketplaceURL:  getEnv("MARKETPLACE_SERVICE_URL", "http://localhost:8092"),
		DevOpsURL:       getEnv("DEVOPS_SERVICE_URL", "http://localhost:8093"),
		NotificationURL: getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8094"),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
