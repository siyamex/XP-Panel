package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/xp-panel/xp-panel/services/filemanager/internal/service"
)

type FilesHandler struct {
	fs *service.FSService
}

func NewFilesHandler(fs *service.FSService) *FilesHandler {
	return &FilesHandler{fs: fs}
}

func (h *FilesHandler) List(c *fiber.Ctx) error {
	path := c.Query("path", "/")
	files, err := h.fs.List(path)
	if err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"files": files, "path": path, "total": len(files)})
}

func (h *FilesHandler) Read(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}
	content, err := h.fs.Read(path)
	if err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"content": string(content), "path": path})
}

func (h *FilesHandler) Write(c *fiber.Ctx) error {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}
	if err := h.fs.Write(req.Path, []byte(req.Content)); err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"success": true, "path": req.Path})
}

func (h *FilesHandler) Delete(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}
	if err := h.fs.Delete(path); err != nil {
		return mapError(err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *FilesHandler) MkDir(c *fiber.Ctx) error {
	var req struct{ Path string `json:"path"` }
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.fs.MkDir(req.Path); err != nil {
		return mapError(err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "path": req.Path})
}

func (h *FilesHandler) Copy(c *fiber.Ctx) error {
	var req struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.fs.Copy(req.Source, req.Destination); err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *FilesHandler) Move(c *fiber.Ctx) error {
	var req struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.fs.Move(req.Source, req.Destination); err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *FilesHandler) Rename(c *fiber.Ctx) error {
	var req struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if err := h.fs.Rename(req.Path, req.NewName); err != nil {
		return mapError(err)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *FilesHandler) Download(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}

	f, stat, err := h.fs.OpenFile(path)
	if err != nil {
		return mapError(err)
	}
	defer f.Close()

	c.Set("Content-Disposition", `attachment; filename="`+stat.Name()+`"`)
	return c.SendStream(f, int(stat.Size()))
}

func mapError(err error) error {
	switch {
	case errors.Is(err, service.ErrPathTraversal):
		return fiber.NewError(fiber.StatusForbidden, "path traversal detected")
	case errors.Is(err, service.ErrNotFound):
		return fiber.ErrNotFound
	case errors.Is(err, service.ErrIsDirectory):
		return fiber.NewError(fiber.StatusBadRequest, "path is a directory")
	default:
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
}
