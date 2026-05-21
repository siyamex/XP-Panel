package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// Store is the common interface for all backup storage backends.
type Store interface {
	// Upload stores the file at localPath under the given fileName and returns the storage URI.
	Upload(ctx context.Context, localPath, fileName string) (string, error)
}

// S3Config configures the S3/MinIO storage backend.
type S3Config struct {
	Bucket    string
	Region    string
	Endpoint  string
	AccessKey string
	SecretKey string
}

// S3Store wraps S3Storage to satisfy the Store interface.
type S3Store struct {
	inner *S3Storage
	cfg   S3Config
}

func NewS3Store(ctx context.Context, cfg S3Config) (*S3Store, error) {
	inner, err := NewS3Storage(ctx, cfg.Bucket, cfg.Endpoint, cfg.Region)
	if err != nil {
		return nil, err
	}
	return &S3Store{inner: inner, cfg: cfg}, nil
}

func (s *S3Store) Upload(ctx context.Context, localPath, fileName string) (string, error) {
	f, err := os.Open(localPath)
	if err != nil {
		return "", fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	key := filepath.Base(fileName)
	if _, err = s.inner.Upload(ctx, key, f); err != nil {
		return "", err
	}
	return fmt.Sprintf("s3://%s/%s", s.cfg.Bucket, key), nil
}

// LocalStoreAdapter wraps LocalStorage to satisfy the Store interface
// (file-path based Upload instead of io.Reader).
type LocalStoreAdapter struct {
	inner *LocalStorage
}

func NewLocalStoreAdapter(dir string) *LocalStoreAdapter {
	return &LocalStoreAdapter{inner: NewLocalStorage(dir)}
}

func (l *LocalStoreAdapter) Upload(ctx context.Context, localPath, fileName string) (string, error) {
	src, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer src.Close()

	key := filepath.Base(fileName)
	_, err = l.inner.Upload(ctx, key, src)
	if err != nil {
		return "", err
	}
	return filepath.Join(l.inner.baseDir, key), nil
}
