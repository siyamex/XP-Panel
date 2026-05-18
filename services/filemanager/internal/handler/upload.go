package handler

import (
	"fmt"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/xp-panel/xp-panel/services/filemanager/internal/service"
)

type UploadHandler struct {
	fs *service.FSService
}

func NewUploadHandler(fs *service.FSService) *UploadHandler {
	return &UploadHandler{fs: fs}
}

func (h *UploadHandler) Upload(c *fiber.Ctx) error {
	destDir := c.FormValue("path", "/")

	form, err := c.MultipartForm()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid multipart form")
	}

	files := form.File["files"]
	if len(files) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "no files provided")
	}

	type result struct {
		Name  string `json:"name"`
		Error string `json:"error,omitempty"`
	}
	results := make([]result, 0, len(files))

	for _, fh := range files {
		destPath := filepath.Join(destDir, filepath.Base(fh.Filename))
		full, err := h.fs.FullPath(destPath)
		if err != nil {
			results = append(results, result{Name: fh.Filename, Error: "path traversal detected"})
			continue
		}

		if err := c.SaveFile(fh, full); err != nil {
			results = append(results, result{Name: fh.Filename, Error: err.Error()})
			continue
		}
		results = append(results, result{Name: fh.Filename})
	}

	return c.JSON(fiber.Map{
		"uploaded": results,
		"count":    fmt.Sprintf("%d/%d", len(files), len(files)),
	})
}
