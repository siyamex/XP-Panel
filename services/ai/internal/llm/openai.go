package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const openAIBaseURL = "https://api.openai.com/v1"

// OpenAIClient is an LLM client for the OpenAI Chat Completions API.
type OpenAIClient struct {
	apiKey string
	http   *http.Client
}

func NewOpenAIClient(apiKey string) *OpenAIClient {
	return &OpenAIClient{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 120 * time.Second},
	}
}

type openaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (c *OpenAIClient) Complete(ctx context.Context, model, system string, msgs []Message, tools []ToolDefinition) (*Response, error) {
	if model == "" {
		model = "gpt-4o-mini"
	}

	oaMsgs := []openaiMessage{{Role: "system", Content: system}}
	for _, m := range msgs {
		oaMsgs = append(oaMsgs, openaiMessage{Role: m.Role, Content: m.Content})
	}

	reqBody := map[string]any{
		"model":      model,
		"messages":   oaMsgs,
		"max_tokens": 4096,
	}
	if len(tools) > 0 {
		funcs := make([]any, len(tools))
		for i, t := range tools {
			funcs[i] = map[string]any{
				"type": "function",
				"function": map[string]any{
					"name":        t.Name,
					"description": t.Description,
					"parameters":  t.InputSchema,
				},
			}
		}
		reqBody["tools"] = funcs
	}

	body, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIBaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai %d: %s", resp.StatusCode, b)
	}

	var result struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("openai decode: %w", err)
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("openai: no choices returned")
	}

	r := &Response{
		Content:   result.Choices[0].Message.Content,
		Model:     result.Model,
		InputTok:  result.Usage.PromptTokens,
		OutputTok: result.Usage.CompletionTokens,
	}
	for _, tc := range result.Choices[0].Message.ToolCalls {
		var args map[string]any
		_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
		r.ToolCalls = append(r.ToolCalls, ToolCall{Name: tc.Function.Name, Input: args})
	}
	return r, nil
}

// Stream is not yet implemented for OpenAI; falls back to Complete.
func (c *OpenAIClient) Stream(ctx context.Context, model, system string, msgs []Message, ch chan<- StreamChunk) error {
	resp, err := c.Complete(ctx, model, system, msgs, nil)
	if err != nil {
		return err
	}
	ch <- StreamChunk{Delta: resp.Content}
	ch <- StreamChunk{Done: true}
	return nil
}
