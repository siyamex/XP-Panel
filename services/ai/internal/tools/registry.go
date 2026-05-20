package tools

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/ai/internal/llm"
)

// Tool is a callable function the AI can invoke.
type Tool interface {
	Definition() llm.ToolDefinition
	Execute(ctx context.Context, input map[string]any) (string, error)
}

// Registry holds all available tools.
type Registry struct {
	tools map[string]Tool
}

// New creates a registry with all built-in tools.
func New(db *pgxpool.Pool) *Registry {
	r := &Registry{tools: make(map[string]Tool)}
	r.Register(&ServerMetricsTool{db: db})
	r.Register(&DomainListTool{db: db})
	r.Register(&ShellCommandTool{})
	return r
}

// Register adds a tool to the registry.
func (r *Registry) Register(t Tool) {
	r.tools[t.Definition().Name] = t
}

// Definitions returns tool definitions for LLM context.
func (r *Registry) Definitions() []llm.ToolDefinition {
	defs := make([]llm.ToolDefinition, 0, len(r.tools))
	for _, t := range r.tools {
		defs = append(defs, t.Definition())
	}
	return defs
}

// Execute runs the named tool with the given input.
func (r *Registry) Execute(ctx context.Context, name string, input map[string]any) (string, error) {
	t, ok := r.tools[name]
	if !ok {
		return "", nil
	}
	return t.Execute(ctx, input)
}
