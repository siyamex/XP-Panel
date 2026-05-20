package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const anthropicBaseURL = "https://api.anthropic.com/v1"
const anthropicVersion = "2023-06-01"

// AnthropicClient is an LLM client for the Anthropic Messages API.
type AnthropicClient struct {
	apiKey string
	http   *http.Client
}

// NewAnthropicClient creates a client using the given API key.
func NewAnthropicClient(apiKey string) *AnthropicClient {
	return &AnthropicClient{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 120 * time.Second},
	}
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Stream    bool               `json:"stream,omitempty"`
	Tools     []any              `json:"tools,omitempty"`
}

type anthropicResponse struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Content []struct {
		Type  string `json:"type"`
		Text  string `json:"text"`
		ID    string `json:"id"`
		Name  string `json:"name"`
		Input any    `json:"input"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	StopReason string `json:"stop_reason"`
}

func (c *AnthropicClient) Complete(ctx context.Context, model, system string, msgs []Message, tools []ToolDefinition) (*Response, error) {
	if model == "" {
		model = "claude-sonnet-4-6"
	}

	anthropicMsgs := make([]anthropicMessage, len(msgs))
	for i, m := range msgs {
		anthropicMsgs[i] = anthropicMessage{Role: m.Role, Content: m.Content}
	}

	reqBody := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		System:    system,
		Messages:  anthropicMsgs,
	}
	if len(tools) > 0 {
		toolDefs := make([]any, len(tools))
		for i, t := range tools {
			toolDefs[i] = map[string]any{
				"name":         t.Name,
				"description":  t.Description,
				"input_schema": t.InputSchema,
			}
		}
		reqBody.Tools = toolDefs
	}

	body, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicBaseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, body)
	}

	var ar anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return nil, fmt.Errorf("anthropic decode: %w", err)
	}

	result := &Response{
		Model:     ar.Model,
		InputTok:  ar.Usage.InputTokens,
		OutputTok: ar.Usage.OutputTokens,
	}
	for _, block := range ar.Content {
		switch block.Type {
		case "text":
			result.Content += block.Text
		case "tool_use":
			inputMap, _ := block.Input.(map[string]any)
			result.ToolCalls = append(result.ToolCalls, ToolCall{
				Name:  block.Name,
				Input: inputMap,
			})
		}
	}
	return result, nil
}

func (c *AnthropicClient) Stream(ctx context.Context, model, system string, msgs []Message, ch chan<- StreamChunk) error {
	if model == "" {
		model = "claude-sonnet-4-6"
	}

	anthropicMsgs := make([]anthropicMessage, len(msgs))
	for i, m := range msgs {
		anthropicMsgs[i] = anthropicMessage{Role: m.Role, Content: m.Content}
	}

	reqBody := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		System:    system,
		Messages:  anthropicMsgs,
		Stream:    true,
	}
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicBaseURL+"/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("anthropic stream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic stream %d: %s", resp.StatusCode, body)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			ch <- StreamChunk{Done: true}
			return nil
		}

		var event struct {
			Type  string `json:"type"`
			Delta *struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		if event.Type == "content_block_delta" && event.Delta != nil && event.Delta.Type == "text_delta" {
			ch <- StreamChunk{Delta: event.Delta.Text}
		}
		if event.Type == "message_stop" {
			ch <- StreamChunk{Done: true}
			return nil
		}
	}
	ch <- StreamChunk{Done: true}
	return scanner.Err()
}
