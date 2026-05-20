package provider

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

type TelegramProvider struct {
	botToken string
	client   *http.Client
}

func NewTelegramProvider() *TelegramProvider {
	return &TelegramProvider{
		botToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *TelegramProvider) Send(chatID, text string) error {
	if p.botToken == "" || chatID == "" {
		return nil
	}
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", p.botToken)
	params := url.Values{}
	params.Set("chat_id", chatID)
	params.Set("text", text)
	params.Set("parse_mode", "Markdown")

	resp, err := p.client.PostForm(apiURL, params)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&result)
	if !result.OK {
		return fmt.Errorf("telegram error: %s", result.Description)
	}
	return nil
}
