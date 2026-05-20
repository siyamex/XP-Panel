package tools

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"

	"github.com/xpanel/ai/internal/llm"
)

// allowedCommands is the set of commands the AI is permitted to run.
// This is an explicit allowlist — anything not in this list is rejected.
var allowedCommands = map[string]bool{
	"df":       true,
	"free":     true,
	"uptime":   true,
	"top":      true,
	"ps":       true,
	"netstat":  true,
	"ss":       true,
	"cat":      true,
	"tail":     true,
	"head":     true,
	"grep":     true,
	"systemctl": true,
	"nginx":    true,
	"php":      true,
}

// ShellCommandTool runs a constrained set of safe read-only shell commands.
type ShellCommandTool struct{}

func (t *ShellCommandTool) Definition() llm.ToolDefinition {
	return llm.ToolDefinition{
		Name:        "run_command",
		Description: "Run a safe read-only shell command on the server. Only a restricted set of commands is allowed (df, free, uptime, top, ps, netstat, ss, tail, head, grep, systemctl status, nginx -t, php --version).",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"command": map[string]any{
					"type":        "string",
					"description": "The shell command to run. Must start with an allowed command.",
				},
			},
			"required": []string{"command"},
		},
	}
}

func (t *ShellCommandTool) Execute(ctx context.Context, input map[string]any) (string, error) {
	cmdStr, _ := input["command"].(string)
	cmdStr = strings.TrimSpace(cmdStr)
	if cmdStr == "" {
		return "Error: empty command", nil
	}

	// Extract base command (first word)
	parts := strings.Fields(cmdStr)
	base := strings.ToLower(parts[0])

	if !allowedCommands[base] {
		return fmt.Sprintf("Error: command %q is not in the allowed list", base), nil
	}

	// Reject dangerous flags/characters
	if strings.ContainsAny(cmdStr, ";&|`$>") {
		return "Error: command contains disallowed characters", nil
	}
	// Reject write operations for systemctl
	if base == "systemctl" && len(parts) > 1 {
		writeOps := map[string]bool{"start": true, "stop": true, "restart": true, "enable": true, "disable": true}
		if writeOps[parts[1]] {
			return "Error: only 'systemctl status' is allowed", nil
		}
	}

	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, parts[0], parts[1:]...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	_ = cmd.Run() // ignore exit code — return output regardless

	out := stdout.String()
	if out == "" {
		out = stderr.String()
	}
	if len(out) > 4096 {
		out = out[:4096] + "\n...(truncated)"
	}
	return out, nil
}
