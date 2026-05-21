package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

type MFAHandler struct {
	mfa *service.MFAService
	jwt *service.JWTService
}

func NewMFAHandler(mfa *service.MFAService, jwt *service.JWTService) *MFAHandler {
	return &MFAHandler{mfa: mfa, jwt: jwt}
}

// POST /api/v1/auth/mfa/totp/setup
func (h *MFAHandler) SetupTOTP(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*service.Claims)

	user, _ := getUserFromClaims(claims)
	result, err := h.mfa.GenerateTOTPSetup(c.Context(), user)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to generate TOTP setup")
	}

	return c.JSON(fiber.Map{"data": result})
}

// POST /api/v1/auth/mfa/totp/confirm
func (h *MFAHandler) ConfirmTOTP(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*service.Claims)

	var body struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if err := h.mfa.ConfirmTOTPSetup(c.Context(), claims.UserID, body.Code); err != nil {
		if err == service.ErrInvalidMFACode {
			return fiber.NewError(fiber.StatusBadRequest, "invalid TOTP code")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to confirm TOTP")
	}

	return c.JSON(fiber.Map{"message": "MFA enabled successfully"})
}

// POST /api/v1/auth/mfa/verify
// Used when MFA is required after login (tempToken provided)
func (h *MFAHandler) Verify(c *fiber.Ctx) error {
	var body struct {
		TempToken    string `json:"tempToken"`
		MFASessionID string `json:"mfa_session_id"` // frontend alias
		Code         string `json:"code"`
		Backup       bool   `json:"backup"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	// Accept either field name
	token := body.TempToken
	if token == "" {
		token = body.MFASessionID
	}

	// Parse temp token
	claims, err := h.jwt.ParseToken(token)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid temp token")
	}

	if body.Backup {
		if err := h.mfa.VerifyBackupCode(c.Context(), claims.UserID, body.Code); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid backup code")
		}
	} else {
		if err := h.mfa.VerifyTOTP(c.Context(), claims.UserID, body.Code); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid MFA code")
		}
	}

	// Build a minimal User from claims to issue a full token pair
	user := &domain.User{
		ID:             claims.UserID,
		OrganizationID: claims.OrgID,
		Email:          claims.Email,
		Username:       claims.Username,
	}
	sessionID := uuid.New()
	pair, _, err := h.jwt.IssueTokenPair(user, sessionID, true)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "could not issue tokens")
	}
	return c.JSON(fiber.Map{"data": pair})
}

// POST /api/v1/auth/mfa/disable
func (h *MFAHandler) Disable(c *fiber.Ctx) error {
	claims := c.Locals("claims").(*service.Claims)

	var body struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	if err := h.mfa.DisableMFA(c.Context(), claims.UserID, body.Code); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid MFA code")
	}

	return c.JSON(fiber.Map{"message": "MFA disabled"})
}
