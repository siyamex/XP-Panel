package provider

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type WebhookProvider struct {
	client *http.Client
}

func NewWebhookProvider() *WebhookProvider {
	return &WebhookProvider{client: &http.Client{Timeout: 15 * time.Second}}
}

type WebhookPayload struct {
	Event     string `json:"event"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

func (p *WebhookProvider) Send(webhookURL, secret, title, message string) error {
	if webhookURL == "" {
		return nil
	}
	payload, _ := json.Marshal(WebhookPayload{
		Event:     "notification",
		Title:     title,
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})

	req, err := http.NewRequest("POST", webhookURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "XP-Panel-Webhook/1.0")

	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(payload)
		req.Header.Set("X-XP-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned %d", resp.StatusCode)
	}
	return nil
}
