package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type SlackProvider struct {
	client *http.Client
}

func NewSlackProvider() *SlackProvider {
	return &SlackProvider{client: &http.Client{Timeout: 10 * time.Second}}
}

func (p *SlackProvider) Send(webhookURL, text string) error {
	if webhookURL == "" {
		return nil
	}
	payload, _ := json.Marshal(map[string]string{"text": text})
	resp, err := p.client.Post(webhookURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("slack webhook returned %d", resp.StatusCode)
	}
	return nil
}
