package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/mail/internal/domain"
	"github.com/xp-panel/xp-panel/services/mail/internal/service"
)

type ForwarderHandler struct {
	svc *service.MailboxService
}

func NewForwarderHandler(svc *service.MailboxService) *ForwarderHandler {
	return &ForwarderHandler{svc: svc}
}

func (h *ForwarderHandler) List(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	list, err := h.svc.ListForwarders(c.Context(), orgID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"forwarders": list, "total": len(list)})
}

func (h *ForwarderHandler) Create(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	var req domain.CreateForwarderRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.SourceLocal == "" || req.SourceDomain == "" || len(req.Destinations) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "source_local, source_domain, and destinations are required")
	}
	f, err := h.svc.CreateForwarder(c.Context(), orgID, req)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(f)
}

func (h *ForwarderHandler) Delete(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.svc.DeleteForwarder(c.Context(), id, orgID); err != nil {
		if errors.Is(err, service.ErrForwarderNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}
