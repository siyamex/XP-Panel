package llm

import (
	"context"
)

// Message is a chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ToolCall represents an AI-requested tool invocation.
type ToolCall struct {
	Name  string         `json:"name"`
	Input map[string]any `json:"input"`
}

// Response is an LLM completion response.
type Response struct {
	Content   string
	ToolCalls []ToolCall
	Model     string
	InputTok  int
	OutputTok int
}

// StreamChunk is a single token chunk from a streaming response.
type StreamChunk struct {
	Delta string
	Done  bool
}

// Client is the interface all LLM backends implement.
type Client interface {
	// Complete sends a non-streaming request.
	Complete(ctx context.Context, model, system string, msgs []Message, tools []ToolDefinition) (*Response, error)

	// Stream sends a streaming request, writing chunks to the provided channel.
	Stream(ctx context.Context, model, system string, msgs []Message, ch chan<- StreamChunk) error
}

// ToolDefinition describes a tool the model can call.
type ToolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}
