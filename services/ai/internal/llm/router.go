package llm

import (
	"context"
	"fmt"
	"strings"
)

// Router selects an LLM backend based on model prefix and key availability.
// Priority: Anthropic → OpenAI → Local (llama.cpp) → error.
type Router struct {
	anthropic *AnthropicClient
	openai    *OpenAIClient
	local     *LocalClient
}

func NewRouter(anthropicKey, openaiKey string) *Router {
	r := &Router{}
	if anthropicKey != "" {
		r.anthropic = NewAnthropicClient(anthropicKey)
	}
	if openaiKey != "" {
		r.openai = NewOpenAIClient(openaiKey)
	}
	// Local model is optional — silently skip if binary/model not present.
	if lc, err := NewLocalClient(); err == nil {
		r.local = lc
	}
	return r
}

func (r *Router) pick(model string) (Client, string, error) {
	if model == "" || isAnthropicModel(model) {
		if r.anthropic != nil {
			return r.anthropic, model, nil
		}
	}
	if isOpenAIModel(model) {
		if r.openai != nil {
			return r.openai, model, nil
		}
	}
	if isLocalModel(model) {
		if r.local != nil {
			return r.local, model, nil
		}
	}
	// Fallback chain
	if r.anthropic != nil {
		return r.anthropic, "claude-sonnet-4-6", nil
	}
	if r.openai != nil {
		return r.openai, "gpt-4o-mini", nil
	}
	if r.local != nil {
		return r.local, "", nil
	}
	return nil, "", fmt.Errorf("no LLM backend configured; set ANTHROPIC_API_KEY or OPENAI_API_KEY")
}

func (r *Router) Complete(ctx context.Context, model, system string, msgs []Message, tools []ToolDefinition) (*Response, error) {
	client, resolvedModel, err := r.pick(model)
	if err != nil {
		return nil, err
	}
	return client.Complete(ctx, resolvedModel, system, msgs, tools)
}

func (r *Router) Stream(ctx context.Context, model, system string, msgs []Message, ch chan<- StreamChunk) error {
	client, resolvedModel, err := r.pick(model)
	if err != nil {
		return err
	}
	return client.Stream(ctx, resolvedModel, system, msgs, ch)
}

func isAnthropicModel(m string) bool {
	return len(m) >= 6 && m[:6] == "claude"
}

func isOpenAIModel(m string) bool {
	return len(m) >= 3 && (m[:3] == "gpt" || m[:2] == "o1" || m[:2] == "o3")
}

// isLocalModel matches model names that refer to local GGUF files: "local", "gguf", or a .gguf path.
func isLocalModel(m string) bool {
	return m == "local" || m == "gguf" || strings.HasSuffix(m, ".gguf")
}
