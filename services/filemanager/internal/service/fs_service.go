package service

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var (
	ErrPathTraversal = errors.New("path traversal detected")
	ErrNotFound      = errors.New("file or directory not found")
	ErrIsDirectory   = errors.New("path is a directory")
	ErrNotDirectory  = errors.New("path is not a directory")
)

type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	IsDir       bool      `json:"is_dir"`
	Mode        string    `json:"mode"`
	ModifiedAt  time.Time `json:"modified_at"`
	MimeType    string    `json:"mime_type,omitempty"`
	Extension   string    `json:"extension,omitempty"`
}

type FSService struct {
	rootDir string
}

func NewFSService(rootDir string) *FSService {
	return &FSService{rootDir: rootDir}
}

// sanitize resolves the requested path against the root, preventing traversal.
func (s *FSService) sanitize(userPath string) (string, error) {
	// Clean and join with root
	clean := filepath.Clean(userPath)
	full := filepath.Join(s.rootDir, clean)

	// Ensure the resolved path is still inside rootDir
	rel, err := filepath.Rel(s.rootDir, full)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", ErrPathTraversal
	}
	return full, nil
}

func (s *FSService) List(userPath string) ([]FileInfo, error) {
	full, err := s.sanitize(userPath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(full)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	var files []FileInfo
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		relPath := filepath.Join(userPath, e.Name())
		files = append(files, FileInfo{
			Name:       e.Name(),
			Path:       relPath,
			Size:       info.Size(),
			IsDir:      e.IsDir(),
			Mode:       info.Mode().String(),
			ModifiedAt: info.ModTime(),
			Extension:  strings.TrimPrefix(filepath.Ext(e.Name()), "."),
		})
	}

	// Directories first, then files, both sorted alphabetically
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return files[i].Name < files[j].Name
	})
	return files, nil
}

func (s *FSService) Read(userPath string) ([]byte, error) {
	full, err := s.sanitize(userPath)
	if err != nil {
		return nil, err
	}

	stat, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if stat.IsDir() {
		return nil, ErrIsDirectory
	}
	if stat.Size() > 10*1024*1024 { // 10MB limit for text editor
		return nil, fmt.Errorf("file too large for editor (max 10MB)")
	}
	return os.ReadFile(full)
}

func (s *FSService) Write(userPath string, content []byte) error {
	full, err := s.sanitize(userPath)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(full), 0755); err != nil {
		return err
	}
	return os.WriteFile(full, content, 0644)
}

func (s *FSService) Delete(userPath string) error {
	full, err := s.sanitize(userPath)
	if err != nil {
		return err
	}
	if _, err := os.Stat(full); os.IsNotExist(err) {
		return ErrNotFound
	}
	return os.RemoveAll(full)
}

func (s *FSService) MkDir(userPath string) error {
	full, err := s.sanitize(userPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(full, 0755)
}

func (s *FSService) Copy(srcPath, dstPath string) error {
	src, err := s.sanitize(srcPath)
	if err != nil {
		return err
	}
	dst, err := s.sanitize(dstPath)
	if err != nil {
		return err
	}

	srcStat, err := os.Stat(src)
	if err != nil {
		return ErrNotFound
	}

	if srcStat.IsDir() {
		return s.copyDir(src, dst)
	}
	return s.copyFile(src, dst)
}

func (s *FSService) Move(srcPath, dstPath string) error {
	src, err := s.sanitize(srcPath)
	if err != nil {
		return err
	}
	dst, err := s.sanitize(dstPath)
	if err != nil {
		return err
	}
	return os.Rename(src, dst)
}

func (s *FSService) Rename(oldPath, newName string) error {
	full, err := s.sanitize(oldPath)
	if err != nil {
		return err
	}
	dir := filepath.Dir(full)
	newFull := filepath.Join(dir, filepath.Base(newName))

	// Ensure new name doesn't escape directory
	relNew, err := filepath.Rel(s.rootDir, newFull)
	if err != nil || strings.HasPrefix(relNew, "..") {
		return ErrPathTraversal
	}
	return os.Rename(full, newFull)
}

func (s *FSService) OpenFile(userPath string) (*os.File, fs.FileInfo, error) {
	full, err := s.sanitize(userPath)
	if err != nil {
		return nil, nil, err
	}

	f, err := os.Open(full)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	stat, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, nil, err
	}
	return f, stat, nil
}

func (s *FSService) RootDir() string {
	return s.rootDir
}

func (s *FSService) FullPath(userPath string) (string, error) {
	return s.sanitize(userPath)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *FSService) copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func (s *FSService) copyDir(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		return s.copyFile(path, target)
	})
}
