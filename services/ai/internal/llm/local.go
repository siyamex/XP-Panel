package llm

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// LocalClient runs a local GGUF model via llama-cli (llama.cpp).
// It looks for the binary at LLAMA_CLI_PATH (default: /usr/local/bin/llama-cli)
// and the model at LLAMA_MODEL_PATH (default: /opt/models/default.gguf).
type LocalClient struct {
	cliPath   string
	modelPath string
	mu        sync.Mutex // serialise subprocess calls
}

func NewLocalClient() (*LocalClient, error) {
	cli := os.Getenv("LLAMA_CLI_PATH")
	if cli == "" {
		cli = "/usr/local/bin/llama-cli"
	}
	model := os.Getenv("LLAMA_MODEL_PATH")
	if model == "" {
		model = "/opt/models/default.gguf"
	}

	if _, err := os.Stat(cli); err != nil {
		return nil, fmt.Errorf("llama-cli not found at %s: %w", cli, err)
	}
	if _, err := os.Stat(model); err != nil {
		return nil, fmt.Errorf("GGUF model not found at %s: %w", model, err)
	}
	return &LocalClient{cliPath: cli, modelPath: model}, nil
}

// ModelName returns the base filename of the loaded model.
func (c *LocalClient) ModelName() string {
	return filepath.Base(c.modelPath)
}

func (c *LocalClient) Complete(ctx context.Context, model, system string, msgs []Message, tools []ToolDefinition) (*Response, error) {
	prompt := buildPrompt(system, msgs)

	c.mu.Lock()
	defer c.mu.Unlock()

	args := []string{
		"-m", c.modelPath,
		"-p", prompt,
		"--temp", "0.7",
		"--top-p", "0.9",
		"-n", "512",
		"--no-display-prompt",
		"-t", "4",
	}

	ctx2, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx2, c.cliPath, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("llama-cli failed: %w — stderr: %s", err, stderr.String())
	}

	text := strings.TrimSpace(stdout.String())
	return &Response{
		Content: text,
		Model:   c.ModelName(),
	}, nil
}

func (c *LocalClient) Stream(ctx context.Context, model, system string, msgs []Message, ch chan<- StreamChunk) error {
	prompt := buildPrompt(system, msgs)

	c.mu.Lock()
	defer c.mu.Unlock()

	args := []string{
		"-m", c.modelPath,
		"-p", prompt,
		"--temp", "0.7",
		"--top-p", "0.9",
		"-n", "512",
		"--no-display-prompt",
		"-t", "4",
	}

	ctx2, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx2, c.cliPath, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("llama-cli start: %w", err)
	}

	scanner := bufio.NewScanner(stdout)
	scanner.Split(bufio.ScanRunes) // stream character by character
	for scanner.Scan() {
		select {
		case <-ctx2.Done():
			_ = cmd.Process.Kill()
			ch <- StreamChunk{Done: true}
			return ctx2.Err()
		default:
			ch <- StreamChunk{Delta: scanner.Text()}
		}
	}

	if err := cmd.Wait(); err != nil && ctx2.Err() == nil {
		ch <- StreamChunk{Done: true}
		return fmt.Errorf("llama-cli: %w", err)
	}
	ch <- StreamChunk{Done: true}
	return nil
}

// buildPrompt converts messages to a ChatML-style prompt string for llama.cpp.
func buildPrompt(system string, msgs []Message) string {
	var sb strings.Builder
	if system != "" {
		sb.WriteString("<|im_start|>system\n")
		sb.WriteString(system)
		sb.WriteString("\n<|im_end|>\n")
	}
	for _, m := range msgs {
		sb.WriteString(fmt.Sprintf("<|im_start|>%s\n%s\n<|im_end|>\n", m.Role, m.Content))
	}
	sb.WriteString("<|im_start|>assistant\n")
	return sb.String()
}

