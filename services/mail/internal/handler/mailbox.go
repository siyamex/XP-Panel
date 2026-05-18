package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/mail/internal/domain"
	"github.com/xp-panel/xp-panel/services/mail/internal/service"
)

type MailboxHandler struct {
	svc *service.MailboxService
}

func NewMailboxHandler(svc *service.MailboxService) *MailboxHandler {
	return &MailboxHandler{svc: svc}
}

func (h *MailboxHandler) List(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	list, err := h.svc.ListMailboxes(c.Context(), orgID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"mailboxes": list, "total": len(list)})
}

func (h *MailboxHandler) Create(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	var req domain.CreateMailboxRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.LocalPart == "" || req.Domain == "" || req.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "local_part, domain, and password are required")
	}
	m, err := h.svc.CreateMailbox(c.Context(), orgID, req)
	if err != nil {
		if errors.Is(err, service.ErrMailboxExists) {
			return fiber.NewError(fiber.StatusConflict, "mailbox already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(m)
}

func (h *MailboxHandler) Update(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req domain.UpdateMailboxRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	m, err := h.svc.UpdateMailbox(c.Context(), id, orgID, req)
	if err != nil {
		if errors.Is(err, service.ErrMailboxNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(m)
}

func (h *MailboxHandler) Delete(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.svc.DeleteMailbox(c.Context(), id, orgID); err != nil {
		if errors.Is(err, service.ErrMailboxNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}
