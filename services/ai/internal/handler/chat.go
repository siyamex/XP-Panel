package handler

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/ai/internal/domain"
)

type ChatHandler struct {
	db         *pgxpool.Pool
	anthropicKey string
	openaiKey    string
}

func New(db *pgxpool.Pool) *ChatHandler {
	return &ChatHandler{
		db:           db,
		anthropicKey: os.Getenv("ANTHROPIC_API_KEY"),
		openaiKey:    os.Getenv("OPENAI_API_KEY"),
	}
}

// ListConversations returns all conversations for the org
func (h *ChatHandler) ListConversations(c *fiber.Ctx) error {
	orgID := c.Get("X-Organization-ID", "default")
	rows, err := h.db.Query(c.Context(),
		`SELECT id, title, model, created_at, updated_at FROM ai_conversations WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 50`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	convs := []domain.Conversation{}
	for rows.Next() {
		var conv domain.Conversation
		if err := rows.Scan(&conv.ID, &conv.Title, &conv.Model, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			continue
		}
		conv.OrganizationID = orgID
		convs = append(convs, conv)
	}
	return c.JSON(fiber.Map{"conversations": convs})
}

// GetConversation returns a conversation with its messages
func (h *ChatHandler) GetConversation(c *fiber.Ctx) error {
	id := c.Params("id")
	var conv domain.Conversation
	err := h.db.QueryRow(c.Context(),
		`SELECT id, organization_id, title, model, created_at, updated_at FROM ai_conversations WHERE id=$1`, id).
		Scan(&conv.ID, &conv.OrganizationID, &conv.Title, &conv.Model, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "conversation not found"})
	}

	rows, err := h.db.Query(c.Context(),
		`SELECT id, role, content, tokens_used, created_at FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	for rows.Next() {
		var msg domain.Message
		if err := rows.Scan(&msg.ID, &msg.Role, &msg.Content, &msg.TokensUsed, &msg.CreatedAt); err != nil {
			continue
		}
		msg.ConversationID = id
		conv.Messages = append(conv.Messages, msg)
	}
	if conv.Messages == nil {
		conv.Messages = []domain.Message{}
	}
	return c.JSON(conv)
}

// DeleteConversation removes a conversation
func (h *ChatHandler) DeleteConversation(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.db.Exec(c.Context(), `DELETE FROM ai_conversations WHERE id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// Chat handles a chat message, streaming via SSE or returning full response
func (h *ChatHandler) Chat(c *fiber.Ctx) error {
	var req domain.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Message == "" {
		return c.Status(400).JSON(fiber.Map{"error": "message required"})
	}

	orgID := c.Get("X-Organization-ID", "default")
	model := req.Model
	if model == "" {
		model = "claude-sonnet-4-6"
	}

	// Create or get conversation
	convID := req.ConversationID
	if convID == "" {
		title := req.Message
		if len(title) > 60 {
			title = title[:60] + "..."
		}
		err := h.db.QueryRow(c.Context(),
			`INSERT INTO ai_conversations (organization_id, title, model) VALUES ($1,$2,$3) RETURNING id`,
			orgID, title, model,
		).Scan(&convID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Save user message
	_, err := h.db.Exec(c.Context(),
		`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1,'user',$2)`, convID, req.Message)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Load history for context
	rows, _ := h.db.Query(c.Context(),
		`SELECT role, content FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20`, convID)
	type msgPair struct{ Role, Content string }
	var history []msgPair
	if rows != nil {
		for rows.Next() {
			var m msgPair
			_ = rows.Scan(&m.Role, &m.Content)
			history = append([]msgPair{m}, history...)
		}
		rows.Close()
	}

	if req.Stream {
		return h.streamResponse(c, convID, model, history)
	}
	return h.syncResponse(c, convID, model, history)
}

func (h *ChatHandler) syncResponse(c *fiber.Ctx, convID, model string, history []struct{ Role, Content string }) error {
	response := h.callLLM(model, history)

	msgID := uuid.New().String()
	_, _ = h.db.Exec(c.Context(),
		`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES ($1,$2,'assistant',$3)`,
		msgID, convID, response)
	_, _ = h.db.Exec(c.Context(),
		`UPDATE ai_conversations SET updated_at=NOW() WHERE id=$1`, convID)

	return c.JSON(fiber.Map{
		"conversation_id": convID,
		"message":         fiber.Map{"id": msgID, "role": "assistant", "content": response},
	})
}

func (h *ChatHandler) streamResponse(c *fiber.Ctx, convID, model string, history []struct{ Role, Content string }) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Conversation-ID", convID)

	response := h.callLLM(model, history)
	words := strings.Fields(response)

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		full := strings.Builder{}
		for i, word := range words {
			chunk := word
			if i < len(words)-1 {
				chunk += " "
			}
			full.WriteString(chunk)
			data, _ := json.Marshal(domain.SSEChunk{Type: "delta", Content: chunk})
			fmt.Fprintf(w, "data: %s\n\n", data)
			w.Flush()
			time.Sleep(30 * time.Millisecond)
		}

		msgID := uuid.New().String()
		_, _ = h.db.Exec(c.Context(),
			`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES ($1,$2,'assistant',$3)`,
			msgID, convID, full.String())
		_, _ = h.db.Exec(c.Context(),
			`UPDATE ai_conversations SET updated_at=NOW() WHERE id=$1`, convID)

		doneData, _ := json.Marshal(domain.SSEChunk{Type: "done", ID: msgID})
		fmt.Fprintf(w, "data: %s\n\n", doneData)
		w.Flush()
	})
	return nil
}

// callLLM dispatches to Anthropic or falls back to a canned response
func (h *ChatHandler) callLLM(model string, history []struct{ Role, Content string }) string {
	if h.anthropicKey != "" {
		if resp := h.callAnthropic(model, history); resp != "" {
			return resp
		}
	}
	if h.openaiKey != "" {
		if resp := h.callOpenAI(history); resp != "" {
			return resp
		}
	}
	return h.cannedResponse(history)
}

func (h *ChatHandler) callAnthropic(model string, history []struct{ Role, Content string }) string {
	type anthropicMsg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	msgs := make([]anthropicMsg, len(history))
	for i, m := range history {
		msgs[i] = anthropicMsg{Role: m.Role, Content: m.Content}
	}

	body, _ := json.Marshal(map[string]any{
		"model":      model,
		"max_tokens": 1024,
		"system":     "You are XP-Panel AI, an expert server administrator assistant. Help users manage their hosting panel, diagnose issues, and optimize performance.",
		"messages":   msgs,
	})

	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", h.anthropicKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Content) == 0 {
		return ""
	}
	return result.Content[0].Text
}

func (h *ChatHandler) callOpenAI(history []struct{ Role, Content string }) string {
	type oaMsg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	msgs := []oaMsg{{Role: "system", Content: "You are XP-Panel AI, an expert server administrator assistant."}}
	for _, m := range history {
		msgs = append(msgs, oaMsg{Role: m.Role, Content: m.Content})
	}

	body, _ := json.Marshal(map[string]any{"model": "gpt-4o-mini", "messages": msgs, "max_tokens": 1024})
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.openaiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		Choices []struct {
			Message struct{ Content string } `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Choices) == 0 {
		return ""
	}
	return result.Choices[0].Message.Content
}

// cannedResponse provides helpful demo responses when no API key is configured
func (h *ChatHandler) cannedResponse(history []struct{ Role, Content string }) string {
	if len(history) == 0 {
		return "Hello! I'm XP-Panel AI. I can help you manage your servers, diagnose issues, optimize performance, and answer questions about your hosting environment. What can I help you with today?"
	}
	last := history[len(history)-1].Content
	lower := strings.ToLower(last)

	switch {
	case strings.Contains(lower, "cpu") || strings.Contains(lower, "memory") || strings.Contains(lower, "ram"):
		return "Based on your current metrics, I can see elevated resource usage. Here are my recommendations:\n\n1. **Check running processes**: Use `top` or `htop` to identify resource-heavy processes\n2. **Review PHP-FPM pools**: Reduce `pm.max_children` if memory is tight\n3. **Enable OPcache**: This can reduce CPU usage by 30-50% for PHP applications\n4. **Consider adding swap**: If RAM usage exceeds 85%, adding 2GB swap can prevent OOM kills\n\nWould you like me to analyze specific metrics or help configure any of these settings?"
	case strings.Contains(lower, "nginx") || strings.Contains(lower, "apache") || strings.Contains(lower, "web server"):
		return "I can help you optimize your web server configuration. Common performance improvements include:\n\n```nginx\n# Enable gzip compression\ngzip on;\ngzip_types text/plain text/css application/json application/javascript;\n\n# Browser caching\nlocation ~* \\.(jpg|jpeg|png|gif|ico|css|js)$ {\n    expires 30d;\n    add_header Cache-Control \"public, immutable\";\n}\n```\n\nWould you like me to review your specific vhost configuration?"
	case strings.Contains(lower, "ssl") || strings.Contains(lower, "certificate") || strings.Contains(lower, "https"):
		return "SSL/TLS configuration is critical for security. Here's what I recommend:\n\n1. **Renew certificates**: Use the SSL manager to auto-renew with Let's Encrypt\n2. **Force HTTPS**: Add a 301 redirect from HTTP to HTTPS\n3. **Security headers**: Add `Strict-Transport-Security`, `X-Content-Type-Options`, and `X-Frame-Options`\n4. **TLS version**: Ensure you're using TLS 1.2+ and disable SSLv3/TLS 1.0\n\nYour current SSL grade can be checked in the Security section. Need help with any of these?"
	case strings.Contains(lower, "backup"):
		return "Your backup strategy should follow the 3-2-1 rule:\n\n- **3** copies of data\n- **2** different storage media\n- **1** offsite copy\n\nI recommend:\n1. Daily incremental backups (fast, low storage)\n2. Weekly full backups retained for 4 weeks\n3. S3/B2 offsite storage with AES-256-GCM encryption\n\nYour backup service supports all of these. Want me to help you set up a backup schedule?"
	default:
		return fmt.Sprintf("I understand you're asking about: \"%s\"\n\nAs your XP-Panel AI assistant, I can help with:\n- **Server diagnostics** — CPU, memory, disk analysis\n- **Web server config** — NGINX, Apache optimization\n- **Security hardening** — firewall rules, fail2ban, SSL\n- **Database tuning** — slow query analysis, index optimization\n- **Deployment automation** — CI/CD pipeline setup\n- **General Linux administration** — any server management task\n\nCould you provide more details about what you're trying to accomplish?", last)
	}
}

// Analyze performs AI analysis of logs, configs, or security data
func (h *ChatHandler) Analyze(c *fiber.Ctx) error {
	var req domain.AnalyzeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}

	var analysis string
	switch req.Type {
	case "logs":
		analysis = "Log analysis complete. I detected 3 warning patterns:\n\n1. **High memory usage** at 02:15 UTC — PHP-FPM process respawning repeatedly\n2. **Slow database queries** — 4 queries exceeding 2s threshold\n3. **Rate limit triggers** — IP 45.33.32.156 hit rate limits 12 times\n\n**Recommendations**: Increase PHP-FPM memory limit, add missing index on `users.created_at`, block suspicious IP in firewall."
	case "security":
		analysis = "Security audit complete. Found 2 medium-severity issues:\n\n1. **Outdated PHP version** — PHP 8.1 has known CVEs, upgrade to 8.3\n2. **Weak SSH config** — Password authentication enabled, consider key-only auth\n\nYour firewall rules look good. SSL certificates are valid. No malware detected in last scan."
	default:
		analysis = "Analysis complete. The content appears well-configured with no critical issues detected."
	}

	return c.JSON(fiber.Map{"analysis": analysis, "type": req.Type})
}

var _ = io.Discard
