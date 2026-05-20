package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type DiscordProvider struct {
	client *http.Client
}

func NewDiscordProvider() *DiscordProvider {
	return &DiscordProvider{client: &http.Client{Timeout: 10 * time.Second}}
}

func (p *DiscordProvider) Send(webhookURL, title, message string) error {
	if webhookURL == "" {
		return nil
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"embeds": []map[string]interface{}{
			{
				"title":       title,
				"description": message,
				"color":       0x5865F2, // Discord blurple
				"timestamp":   time.Now().UTC().Format(time.RFC3339),
				"footer":      map[string]string{"text": "XP-Panel"},
			},
		},
	})
	resp, err := p.client.Post(webhookURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("discord webhook returned %d", resp.StatusCode)
	}
	return nil
}
