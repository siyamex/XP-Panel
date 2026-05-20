package storage

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// B2Config holds Backblaze B2 credentials.
type B2Config struct {
	KeyID      string
	AppKey     string
	BucketName string
}

// B2Store uploads files to Backblaze B2.
type B2Store struct {
	cfg B2Config
}

func NewB2Store(cfg B2Config) (*B2Store, error) {
	if cfg.KeyID == "" || cfg.AppKey == "" || cfg.BucketName == "" {
		return nil, fmt.Errorf("backblaze: KeyID, AppKey, and BucketName are required")
	}
	return &B2Store{cfg: cfg}, nil
}

type b2AuthResponse struct {
	AccountID          string `json:"accountId"`
	AuthorizationToken string `json:"authorizationToken"`
	APIURL             string `json:"apiUrl"`
	DownloadURL        string `json:"downloadUrl"`
}

type b2UploadURLResponse struct {
	BucketID           string `json:"bucketId"`
	UploadURL          string `json:"uploadUrl"`
	AuthorizationToken string `json:"authorizationToken"`
}

type b2BucketListResponse struct {
	Buckets []struct {
		BucketID   string `json:"bucketId"`
		BucketName string `json:"bucketName"`
	} `json:"buckets"`
}

// Upload uploads the file at localPath to B2 under fileName.
// Returns the b2:// URI and any error.
func (s *B2Store) Upload(ctx context.Context, localPath, fileName string) (string, error) {
	// Authorize account
	auth, err := s.authorize(ctx)
	if err != nil {
		return "", fmt.Errorf("b2 authorize: %w", err)
	}

	// Resolve bucket ID
	bucketID, err := s.getBucketID(ctx, auth, s.cfg.BucketName)
	if err != nil {
		return "", fmt.Errorf("b2 get bucket: %w", err)
	}

	// Get upload URL
	uploadURL, uploadToken, err := s.getUploadURL(ctx, auth, bucketID)
	if err != nil {
		return "", fmt.Errorf("b2 upload url: %w", err)
	}

	// Read file
	data, err := os.ReadFile(localPath)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}

	// SHA1 hash
	h := sha1.Sum(data)
	sha1Hex := hex.EncodeToString(h[:])

	destName := filepath.Base(fileName)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", uploadToken)
	req.Header.Set("X-Bz-File-Name", destName)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Length", fmt.Sprintf("%d", len(data)))
	req.Header.Set("X-Bz-Content-Sha1", sha1Hex)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("b2 upload request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("b2 upload failed (%d): %s", resp.StatusCode, body)
	}

	return fmt.Sprintf("b2://%s/%s", s.cfg.BucketName, destName), nil
}

func (s *B2Store) authorize(ctx context.Context) (*b2AuthResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.backblazeb2.com/b2api/v3/b2_authorize_account", nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(s.cfg.KeyID, s.cfg.AppKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("authorize failed (%d): %s", resp.StatusCode, body)
	}

	var auth b2AuthResponse
	return &auth, json.NewDecoder(resp.Body).Decode(&auth)
}

func (s *B2Store) getBucketID(ctx context.Context, auth *b2AuthResponse, bucketName string) (string, error) {
	url := auth.APIURL + "/b2api/v3/b2_list_buckets?accountId=" + auth.AccountID + "&bucketName=" + bucketName
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", auth.AuthorizationToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var list b2BucketListResponse
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return "", err
	}
	for _, b := range list.Buckets {
		if b.BucketName == bucketName {
			return b.BucketID, nil
		}
	}
	return "", fmt.Errorf("bucket %q not found", bucketName)
}

func (s *B2Store) getUploadURL(ctx context.Context, auth *b2AuthResponse, bucketID string) (string, string, error) {
	body := fmt.Sprintf(`{"bucketId":"%s"}`, bucketID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		auth.APIURL+"/b2api/v3/b2_get_upload_url",
		bytes.NewBufferString(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", auth.AuthorizationToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var result b2UploadURLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}
	return result.UploadURL, result.AuthorizationToken, nil
}
