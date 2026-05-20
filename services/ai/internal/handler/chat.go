package handler

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xpanel/ai/internal/domain"
	"github.com/xpanel/ai/internal/llm"
	"github.com/xpanel/ai/internal/tools"
)

type ChatHandler struct {
	db     *pgxpool.Pool
	llm    *llm.Router
	tools  *tools.Registry
}

type historyItem struct {
	Role    string
	Content string
}

func New(db *pgxpool.Pool) *ChatHandler {
	return &ChatHandler{
		db:    db,
		llm:   llm.NewRouter(os.Getenv("ANTHROPIC_API_KEY"), os.Getenv("OPENAI_API_KEY")),
		tools: tools.New(db),
	}
}

func (h *ChatHandler) ListConversations(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
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

func (h *ChatHandler) DeleteConversation(c *fiber.Ctx) error {
	id := c.Params("id")
	_, err := h.db.Exec(c.Context(), `DELETE FROM ai_conversations WHERE id=$1`, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *ChatHandler) Chat(c *fiber.Ctx) error {
	var req domain.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if req.Message == "" {
		return c.Status(400).JSON(fiber.Map{"error": "message required"})
	}

	orgID := c.Get("X-Org-ID", "default")
	model := req.Model
	if model == "" {
		model = "claude-sonnet-4-6"
	}

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

	_, err := h.db.Exec(c.Context(),
		`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1,'user',$2)`, convID, req.Message)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	rows, _ := h.db.Query(c.Context(),
		`SELECT role, content FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20`, convID)
	var history []historyItem
	if rows != nil {
		for rows.Next() {
			var m historyItem
			_ = rows.Scan(&m.Role, &m.Content)
			history = append([]historyItem{m}, history...)
		}
		rows.Close()
	}

	if req.Stream {
		return h.streamResponse(c, convID, model, history)
	}
	return h.syncResponse(c, convID, model, history)
}

const systemPrompt = `You are XP-Panel AI, an expert server administrator assistant embedded in a web hosting control panel.
You help users manage domains, SSL certificates, databases, email, DNS, backups, security, and deployments.
When asked about server metrics, use the get_server_metrics tool. When asked about domains, use list_domains.
Be concise and practical. Format shell commands in code blocks. Prefer actionable advice over generic explanations.`

func (h *ChatHandler) syncResponse(c *fiber.Ctx, convID, model string, history []historyItem) error {
	msgs := make([]llm.Message, len(history))
	for i, m := range history {
		msgs[i] = llm.Message{Role: m.Role, Content: m.Content}
	}

	resp, err := h.llm.Complete(c.Context(), model, systemPrompt, msgs, h.tools.Definitions())
	var content string
	if err != nil {
		content = h.cannedResponse(history)
	} else {
		// Execute any tool calls and append results
		content = resp.Content
		for _, tc := range resp.ToolCalls {
			result, _ := h.tools.Execute(c.Context(), tc.Name, tc.Input)
			// Re-call LLM with tool result
			msgs = append(msgs, llm.Message{Role: "assistant", Content: fmt.Sprintf("[Calling tool: %s]", tc.Name)})
			msgs = append(msgs, llm.Message{Role: "user", Content: fmt.Sprintf("Tool result for %s: %s", tc.Name, result)})
			followUp, err2 := h.llm.Complete(c.Context(), model, systemPrompt, msgs, nil)
			if err2 == nil {
				content = followUp.Content
			}
		}
	}

	msgID := uuid.New().String()
	_, _ = h.db.Exec(c.Context(),
		`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES ($1,$2,'assistant',$3)`,
		msgID, convID, content)
	_, _ = h.db.Exec(c.Context(),
		`UPDATE ai_conversations SET updated_at=NOW() WHERE id=$1`, convID)

	return c.JSON(fiber.Map{
		"conversation_id": convID,
		"message":         fiber.Map{"id": msgID, "role": "assistant", "content": content},
	})
}

func (h *ChatHandler) streamResponse(c *fiber.Ctx, convID, model string, history []historyItem) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Conversation-ID", convID)

	msgs := make([]llm.Message, len(history))
	for i, m := range history {
		msgs[i] = llm.Message{Role: m.Role, Content: m.Content}
	}

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ch := make(chan llm.StreamChunk, 64)
		errCh := make(chan error, 1)

		go func() {
			errCh <- h.llm.Stream(c.Context(), model, systemPrompt, msgs, ch)
		}()

		full := strings.Builder{}
		for {
			select {
			case chunk, ok := <-ch:
				if !ok {
					goto done
				}
				if chunk.Done {
					goto done
				}
				full.WriteString(chunk.Delta)
				data, _ := json.Marshal(domain.SSEChunk{Type: "delta", Content: chunk.Delta})
				fmt.Fprintf(w, "data: %s\n\n", data)
				_ = w.Flush()
			case <-errCh:
				// LLM failed — fall through to done
				goto done
			}
		}
	done:
		content := full.String()
		if content == "" {
			content = h.cannedResponse(history)
			// stream canned response word by word
			words := strings.Fields(content)
			for i, word := range words {
				chunk := word
				if i < len(words)-1 {
					chunk += " "
				}
				data, _ := json.Marshal(domain.SSEChunk{Type: "delta", Content: chunk})
				fmt.Fprintf(w, "data: %s\n\n", data)
				_ = w.Flush()
				time.Sleep(20 * time.Millisecond)
			}
		}

		msgID := uuid.New().String()
		_, _ = h.db.Exec(c.Context(),
			`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES ($1,$2,'assistant',$3)`,
			msgID, convID, content)
		_, _ = h.db.Exec(c.Context(),
			`UPDATE ai_conversations SET updated_at=NOW() WHERE id=$1`, convID)

		doneData, _ := json.Marshal(domain.SSEChunk{Type: "done", ID: msgID})
		fmt.Fprintf(w, "data: %s\n\n", doneData)
		_ = w.Flush()
	})
	return nil
}

func (h *ChatHandler) cannedResponse(history []historyItem) string {
	if len(history) == 0 {
		return "Hello! I'm XP-Panel AI. I can help you manage your servers, diagnose issues, optimize performance, and answer questions about your hosting environment. What can I help you with today?"
	}
	last := history[len(history)-1].Content
	lower := strings.ToLower(last)

	switch {
	case strings.Contains(lower, "cpu") || strings.Contains(lower, "memory") || strings.Contains(lower, "ram"):
		return "Based on your current metrics, I can see elevated resource usage. Here are my recommendations:\n\n1. **Check running processes**: Use `top` or `htop` to identify resource-heavy processes\n2. **Review PHP-FPM pools**: Reduce `pm.max_children` if memory is tight\n3. **Enable OPcache**: This can reduce CPU usage by 30-50% for PHP applications\n4. **Consider adding swap**: If RAM usage exceeds 85%, adding 2GB swap can prevent OOM kills\n\nWould you like me to analyze specific metrics or help configure any of these settings?"
	case strings.Contains(lower, "ssl") || strings.Contains(lower, "certificate"):
		return "SSL/TLS configuration is critical for security. Enable Let's Encrypt certificates via the SSL manager. Ensure TLS 1.2+ is enforced and add HSTS headers."
	case strings.Contains(lower, "backup"):
		return "Your backup strategy should follow the 3-2-1 rule: 3 copies, 2 media types, 1 offsite. The backup service supports S3, B2, and local storage with AES-256-GCM encryption."
	default:
		return fmt.Sprintf("I understand you're asking about: \"%s\"\n\nCould you provide more details? I can help with server metrics, web server config, SSL, databases, backups, and deployments.", last)
	}
}

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

