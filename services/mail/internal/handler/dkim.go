package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/mail/internal/domain"
	"github.com/xp-panel/xp-panel/services/mail/internal/service"
)

type DKIMHandler struct {
	svc *service.MailboxService
}

func NewDKIMHandler(svc *service.MailboxService) *DKIMHandler {
	return &DKIMHandler{svc: svc}
}

func (h *DKIMHandler) Get(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	d := c.Params("domain")
	key, err := h.svc.GetDKIM(c.Context(), d, orgID)
	if err != nil {
		if errors.Is(err, service.ErrDKIMNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(key)
}

func (h *DKIMHandler) Generate(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	var req domain.GenerateDKIMRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Domain == "" {
		return fiber.NewError(fiber.StatusBadRequest, "domain is required")
	}
	key, err := h.svc.GenerateDKIM(c.Context(), orgID, req)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(key)
}

func (h *DKIMHandler) Delete(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	d := c.Params("domain")
	if err := h.svc.DeleteDKIM(c.Context(), d, orgID); err != nil {
		if errors.Is(err, service.ErrDKIMNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}
