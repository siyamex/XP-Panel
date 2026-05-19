package domain

import "time"

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Role           string    `json:"role"`
	Content        string    `json:"content"`
	TokensUsed     int       `json:"tokens_used,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Conversation struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Title          string    `json:"title"`
	Model          string    `json:"model"`
	Messages       []Message `json:"messages,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type ChatRequest struct {
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message"`
	Model          string `json:"model"`
	Stream         bool   `json:"stream"`
}

type AnalyzeRequest struct {
	Type    string `json:"type"` // "logs", "config", "security"
	Content string `json:"content"`
}

type SSEChunk struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // "delta", "done", "error"
	Content string `json:"content"`
}
