package handler

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/xp-panel/xp-panel/services/filemanager/internal/service"
)

type ArchiveHandler struct {
	fs *service.FSService
}

func NewArchiveHandler(fs *service.FSService) *ArchiveHandler {
	return &ArchiveHandler{fs: fs}
}

type CompressRequest struct {
	Paths  []string `json:"paths"`
	Output string   `json:"output"`
	Format string   `json:"format"` // "zip" or "tar.gz"
}

func (h *ArchiveHandler) Compress(c *fiber.Ctx) error {
	var req CompressRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if len(req.Paths) == 0 || req.Output == "" {
		return fiber.NewError(fiber.StatusBadRequest, "paths and output are required")
	}
	if req.Format == "" {
		req.Format = "zip"
	}

	outFull, err := h.fs.FullPath(req.Output)
	if err != nil {
		return mapError(err)
	}

	switch req.Format {
	case "zip":
		err = h.compressZip(req.Paths, outFull)
	case "tar.gz", "tgz":
		err = h.compressTarGz(req.Paths, outFull)
	default:
		return fiber.NewError(fiber.StatusBadRequest, "unsupported format: use zip or tar.gz")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"success": true, "output": req.Output})
}

type ExtractRequest struct {
	Path        string `json:"path"`
	Destination string `json:"destination"`
}

func (h *ArchiveHandler) Extract(c *fiber.Ctx) error {
	var req ExtractRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Path == "" {
		return fiber.NewError(fiber.StatusBadRequest, "path is required")
	}

	srcFull, err := h.fs.FullPath(req.Path)
	if err != nil {
		return mapError(err)
	}

	destDir := req.Destination
	if destDir == "" {
		destDir = filepath.Dir(req.Path)
	}
	destFull, err := h.fs.FullPath(destDir)
	if err != nil {
		return mapError(err)
	}

	lower := strings.ToLower(req.Path)
	switch {
	case strings.HasSuffix(lower, ".zip"):
		err = h.extractZip(srcFull, destFull)
	case strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz"):
		err = h.extractTarGz(srcFull, destFull)
	default:
		return fiber.NewError(fiber.StatusBadRequest, "unsupported archive format")
	}
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(fiber.Map{"success": true, "destination": destDir})
}

func (h *ArchiveHandler) compressZip(paths []string, output string) error {
	zf, err := os.Create(output)
	if err != nil {
		return err
	}
	defer zf.Close()

	w := zip.NewWriter(zf)
	defer w.Close()

	for _, p := range paths {
		full, err := h.fs.FullPath(p)
		if err != nil {
			continue
		}
		if err := addToZip(w, full, filepath.Base(full)); err != nil {
			return err
		}
	}
	return nil
}

func addToZip(w *zip.Writer, srcPath, baseName string) error {
	stat, err := os.Stat(srcPath)
	if err != nil {
		return err
	}

	if stat.IsDir() {
		return filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return err
			}
			rel, _ := filepath.Rel(filepath.Dir(srcPath), path)
			fw, err := w.Create(rel)
			if err != nil {
				return err
			}
			f, err := os.Open(path)
			if err != nil {
				return err
			}
			defer f.Close()
			_, err = io.Copy(fw, f)
			return err
		})
	}

	fw, err := w.Create(baseName)
	if err != nil {
		return err
	}
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(fw, f)
	return err
}

func (h *ArchiveHandler) compressTarGz(paths []string, output string) error {
	tf, err := os.Create(output)
	if err != nil {
		return err
	}
	defer tf.Close()

	gz := gzip.NewWriter(tf)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()

	for _, p := range paths {
		full, err := h.fs.FullPath(p)
		if err != nil {
			continue
		}
		if err := addToTar(tw, full, filepath.Base(full)); err != nil {
			return err
		}
	}
	return nil
}

func addToTar(tw *tar.Writer, srcPath, baseName string) error {
	return filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(filepath.Dir(srcPath), path)
		hdr := &tar.Header{
			Name:    rel,
			Size:    info.Size(),
			Mode:    int64(info.Mode()),
			ModTime: info.ModTime(),
		}
		if info.IsDir() {
			hdr.Typeflag = tar.TypeDir
			hdr.Name += "/"
			return tw.WriteHeader(hdr)
		}
		hdr.Typeflag = tar.TypeReg
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(tw, f)
		return err
	})
}

func (h *ArchiveHandler) extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		target := filepath.Join(dest, f.Name)
		// Security: prevent zip slip
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("zip slip detected: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0755)
			continue
		}
		os.MkdirAll(filepath.Dir(target), 0755)
		out, err := os.Create(target)
		if err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func (h *ArchiveHandler) extractTarGz(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(dest, hdr.Name)
		if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("tar slip detected: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0755)
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			_, err = io.Copy(out, tr)
			out.Close()
			if err != nil {
				return err
			}
		}
	}
	return nil
}
