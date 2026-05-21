package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// CORS returns a configured CORS middleware.
// Allowed origins are read from the CORS_ORIGINS environment variable
// (comma-separated). Falls back to permissive dev settings when unset.
func CORS() fiber.Handler {
	originsEnv := os.Getenv("CORS_ORIGINS")

	var allowOrigins string
	if originsEnv != "" {
		// Trim whitespace around each origin
		origins := strings.Split(originsEnv, ",")
		for i, o := range origins {
			origins[i] = strings.TrimSpace(o)
		}
		allowOrigins = strings.Join(origins, ",")
	} else {
		// Dev default — allow localhost on common frontend ports
		allowOrigins = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"
	}

	return cors.New(cors.Config{
		AllowOrigins: allowOrigins,
		AllowMethods: strings.Join([]string{
			fiber.MethodGet,
			fiber.MethodPost,
			fiber.MethodPut,
			fiber.MethodPatch,
			fiber.MethodDelete,
			fiber.MethodOptions,
		}, ","),
		AllowHeaders: strings.Join([]string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-Org-ID",
			"X-User-ID",
			"X-Request-ID",
			"X-Forwarded-For",
		}, ","),
		ExposeHeaders:    "X-Request-ID,X-Rate-Limit-Remaining",
		AllowCredentials: true,
		MaxAge:           86400, // 24h preflight cache
	})
}
