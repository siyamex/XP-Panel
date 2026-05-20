package llm

import (
	"context"
	"fmt"
)

// Router selects an LLM backend based on model prefix and key availability.
// Priority: Anthropic → OpenAI → error.
type Router struct {
	anthropic *AnthropicClient
	openai    *OpenAIClient
}

func NewRouter(anthropicKey, openaiKey string) *Router {
	r := &Router{}
	if anthropicKey != "" {
		r.anthropic = NewAnthropicClient(anthropicKey)
	}
	if openaiKey != "" {
		r.openai = NewOpenAIClient(openaiKey)
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
	// Fallback chain
	if r.anthropic != nil {
		return r.anthropic, "claude-sonnet-4-6", nil
	}
	if r.openai != nil {
		return r.openai, "gpt-4o-mini", nil
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
