package main

import (
	"os"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	RedisAddr     string
	JWTSecret     string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
	AllowOrigins  string
	WebAuthnOrigin string
	WebAuthnRPID   string
}

func loadConfig() Config {
	accessExpiry, _ := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	refreshExpiry, _ := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))

	return Config{
		Port:           getEnv("PORT", "8081"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://xppanel:devpassword@localhost:5432/xppanel?sslmode=disable"),
		RedisAddr:      getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-jwt-secret-change-in-production"),
		AccessExpiry:   accessExpiry,
		RefreshExpiry:  refreshExpiry,
		AllowOrigins:   getEnv("CORS_ORIGINS", "http://localhost:3000"),
		WebAuthnOrigin: getEnv("WEBAUTHN_ORIGIN", "http://localhost:3000"),
		WebAuthnRPID:   getEnv("WEBAUTHN_RPID", "localhost"),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
