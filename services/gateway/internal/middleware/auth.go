package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// RequestContext is attached to every authenticated request.
type RequestContext struct {
	UserID    uuid.UUID
	OrgID     uuid.UUID
	Email     string
	Username  string
	Roles     []string
	Perms     []string
	SessionID uuid.UUID
	MFADone   bool
	IsAPI     bool
	Scopes    []string
}

type jwtClaims struct {
	UserID    uuid.UUID `json:"sub"`
	OrgID     uuid.UUID `json:"org"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Roles     []string  `json:"roles"`
	Perms     []string  `json:"perms"`
	SessionID uuid.UUID `json:"sid"`
	MFADone   bool      `json:"mfa"`
	IsAPI     bool      `json:"api,omitempty"`
	Scopes    []string  `json:"scopes,omitempty"`
	jwt.RegisteredClaims
}

// JWTAuth validates the Bearer token and injects RequestContext into locals.
func JWTAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if len(authHeader) < 8 || !strings.EqualFold(authHeader[:7], "bearer ") {
			return fiber.NewError(fiber.StatusUnauthorized, "missing or invalid authorization header")
		}

		tokenStr := authHeader[7:]
		claims := &jwtClaims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(fiber.StatusUnauthorized, "unexpected signing method")
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		c.Locals("ctx", &RequestContext{
			UserID:    claims.UserID,
			OrgID:     claims.OrgID,
			Email:     claims.Email,
			Username:  claims.Username,
			Roles:     claims.Roles,
			Perms:     claims.Perms,
			SessionID: claims.SessionID,
			MFADone:   claims.MFADone,
			IsAPI:     claims.IsAPI,
			Scopes:    claims.Scopes,
		})

		// Forward user context to upstream services as headers
		c.Request().Header.Set("X-User-ID", claims.UserID.String())
		c.Request().Header.Set("X-Org-ID", claims.OrgID.String())
		c.Request().Header.Set("X-User-Email", claims.Email)
		c.Request().Header.Set("X-User-Roles", strings.Join(claims.Roles, ","))
		c.Request().Header.Set("X-MFA-Done", boolToStr(claims.MFADone))

		return c.Next()
	}
}

// RequirePerm checks that the user has a specific permission.
func RequirePerm(perm string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rctx, ok := c.Locals("ctx").(*RequestContext)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
		}

		for _, p := range rctx.Perms {
			if p == "super:*" || p == perm {
				return c.Next()
			}
		}

		return fiber.NewError(fiber.StatusForbidden, "insufficient permissions: "+perm)
	}
}

// RequireRole checks that the user has one of the specified roles.
func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		rctx, ok := c.Locals("ctx").(*RequestContext)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
		}

		for _, userRole := range rctx.Roles {
			if userRole == "super_admin" {
				return c.Next()
			}
			for _, allowedRole := range roles {
				if userRole == allowedRole {
					return c.Next()
				}
			}
		}

		return fiber.NewError(fiber.StatusForbidden, "access denied")
	}
}

// RequireMFA ensures the user has completed MFA verification.
func RequireMFA() fiber.Handler {
	return func(c *fiber.Ctx) error {
		rctx, ok := c.Locals("ctx").(*RequestContext)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
		}
		if !rctx.MFADone {
			return fiber.NewError(fiber.StatusForbidden, "MFA verification required")
		}
		return c.Next()
	}
}

func boolToStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
