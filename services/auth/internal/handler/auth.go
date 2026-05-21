package handler

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
	jwt  *service.JWTService
}

func NewAuthHandler(auth *service.AuthService, jwt *service.JWTService) *AuthHandler {
	return &AuthHandler{auth: auth, jwt: jwt}
}

// POST /api/v1/auth/register
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var body struct {
		OrgName  string `json:"orgName"  validate:"required,min=2,max=100"`
		OrgSlug  string `json:"orgSlug"  validate:"required,min=2,max=50,alphanum"`
		Email    string `json:"email"    validate:"required,email"`
		Username string `json:"username" validate:"required,min=3,max=50,alphanum"`
		Password string `json:"password" validate:"required,min=8,max=128"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	pair, err := h.auth.Register(c.Context(), service.RegisterInput{
		OrgName:  body.OrgName,
		OrgSlug:  strings.ToLower(body.OrgSlug),
		Email:    body.Email,
		Username: body.Username,
		Password: body.Password,
	})
	if err != nil {
		switch err {
		case service.ErrUserExists:
			return fiber.NewError(fiber.StatusConflict, err.Error())
		case service.ErrOrgSlugTaken:
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "registration failed")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"data":    pair,
		"message": "Registration successful. Please verify your email.",
	})
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	result, err := h.auth.Login(c.Context(), service.LoginInput{
		Email:    body.Email,
		Password: body.Password,
		IP:       c.IP(),
		UA:       c.Get("User-Agent"),
	})
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			return fiber.NewError(fiber.StatusUnauthorized, "invalid email or password")
		case service.ErrAccountLocked:
			return fiber.NewError(fiber.StatusTooManyRequests, "account temporarily locked")
		case service.ErrAccountSuspended:
			return fiber.NewError(fiber.StatusForbidden, "account suspended")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "login failed")
	}

	if result.MFARequired {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"mfaRequired": true,
			"tempToken":   result.TempToken,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data": result.Tokens,
	})
}

// POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	pair, err := h.auth.Refresh(c.Context(), body.RefreshToken)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired refresh token")
	}

	return c.JSON(fiber.Map{"data": pair})
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}

	_ = h.auth.Logout(c.Context(), claims.SessionID)
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil || req.Email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email is required")
	}
	// token returned only for local dev / email sending; in prod send via email
	_, _ = h.auth.ForgotPassword(c.Context(), req.Email)
	// Always respond 200 to avoid user enumeration
	return c.JSON(fiber.Map{"message": "If that email exists, a reset link has been sent"})
}

// POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil || req.Token == "" || req.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "token and password are required")
	}
	if err := h.auth.ResetPassword(c.Context(), req.Token, req.Password); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid or expired reset token")
	}
	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}

// GET /api/v1/auth/me
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok {
		return fiber.NewError(fiber.StatusUnauthorized, "not authenticated")
	}

	_ = claims
	// TODO: fetch fresh user from DB and return profile
	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"id":       claims.UserID,
			"email":    claims.Email,
			"username": claims.Username,
			"roles":    claims.Roles,
			"orgId":    claims.OrgID,
		},
	})
}
