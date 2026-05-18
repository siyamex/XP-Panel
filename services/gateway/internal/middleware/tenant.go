package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// TenantIsolation ensures resource IDs in the path belong to the authenticated org.
// This is applied automatically when the gateway proxies org-scoped resources.
func TenantIsolation() fiber.Handler {
	return func(c *fiber.Ctx) error {
		rctx, ok := c.Locals("ctx").(*RequestContext)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
		}

		// Inject org ID as header so upstream services can enforce isolation
		c.Request().Header.Set("X-Org-ID", rctx.OrgID.String())
		c.Request().Header.Set("X-User-ID", rctx.UserID.String())

		return c.Next()
	}
}

// OrgFromPath extracts and validates the org ID from a path parameter.
func OrgFromPath(param string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		orgIDStr := c.Params(param)
		if orgIDStr == "" {
			return c.Next()
		}

		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid organization ID")
		}

		rctx, ok := c.Locals("ctx").(*RequestContext)
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
		}

		// Super admin can access any org
		for _, role := range rctx.Roles {
			if role == "super_admin" {
				return c.Next()
			}
		}

		if orgID != rctx.OrgID {
			return fiber.NewError(fiber.StatusForbidden, "access denied to this organization")
		}

		return c.Next()
	}
}
