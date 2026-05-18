package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/dns/internal/domain"
	"github.com/xp-panel/xp-panel/services/dns/internal/service"
)

type RecordHandler struct {
	svc *service.ZoneService
}

func NewRecordHandler(svc *service.ZoneService) *RecordHandler {
	return &RecordHandler{svc: svc}
}

func (h *RecordHandler) List(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	zoneID, err := uuid.Parse(c.Params("zoneId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	records, err := h.svc.ListRecords(c.Context(), zoneID, orgID)
	if err != nil {
		if errors.Is(err, service.ErrZoneNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"records": records, "total": len(records)})
}

func (h *RecordHandler) Create(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	zoneID, err := uuid.Parse(c.Params("zoneId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req domain.CreateRecordRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Name == "" || req.Type == "" || req.Content == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name, type, and content are required")
	}
	if !domain.ValidRecordTypes[req.Type] {
		return fiber.NewError(fiber.StatusBadRequest, "invalid record type")
	}

	record, err := h.svc.CreateRecord(c.Context(), zoneID, orgID, req)
	if err != nil {
		if errors.Is(err, service.ErrZoneNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *RecordHandler) Update(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	zoneID, err := uuid.Parse(c.Params("zoneId"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	recordID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req domain.UpdateRecordRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	record, err := h.svc.UpdateRecord(c.Context(), recordID, zoneID, orgID, req)
	if err != nil {
		if errors.Is(err, service.ErrZoneNotFound) || errors.Is(err, service.ErrRecordNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(record)
}

func (h *RecordHandler) Delete(c *fiber.Ctx) error {
	orgID, err := uuid.Parse(c.Get("X-Org-ID"))
	if err != nil {
		return fiber.ErrUnauthorized
	}
	zoneID, err := uuid.Parse(c.Params("zoneId"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	recordID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	if err := h.svc.DeleteRecord(c.Context(), recordID, zoneID, orgID); err != nil {
		if errors.Is(err, service.ErrZoneNotFound) || errors.Is(err, service.ErrRecordNotFound) {
			return fiber.ErrNotFound
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}
