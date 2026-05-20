package handler

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// POST /devops/webhooks/github/:pipelineId — GitHub push/PR webhook trigger
func (h *PipelineHandler) GitHubWebhook(c *fiber.Ctx) error {
	pipelineID := c.Params("pipelineId")
	orgID := c.Get("X-Org-ID", "default")

	// Verify GitHub signature
	secret, err := h.getPipelineWebhookSecret(c, pipelineID, orgID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "pipeline not found"})
	}
	if secret != "" {
		sig := c.Get("X-Hub-Signature-256")
		if !verifyGitHubSignature(c.Body(), sig, secret) {
			return c.Status(401).JSON(fiber.Map{"error": "invalid signature"})
		}
	}

	event := c.Get("X-GitHub-Event")
	var payload map[string]interface{}
	_ = json.Unmarshal(c.Body(), &payload)

	// Trigger pipeline on push or PR merge
	if event == "push" || (event == "pull_request" && getStr(payload, "action") == "closed" &&
		getBool(payload, "pull_request", "merged")) {
		branch := extractBranch(payload, event)
		triggerErr := h.triggerPipelineInternal(c, pipelineID, orgID, map[string]string{
			"trigger":    "webhook",
			"provider":   "github",
			"event":      event,
			"branch":     branch,
			"commit_sha": getStr(payload, "after"),
		})
		if triggerErr != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to trigger pipeline"})
		}
	}

	return c.JSON(fiber.Map{"received": true})
}

// POST /devops/webhooks/gitlab/:pipelineId — GitLab push webhook trigger
func (h *PipelineHandler) GitLabWebhook(c *fiber.Ctx) error {
	pipelineID := c.Params("pipelineId")
	orgID := c.Get("X-Org-ID", "default")

	// Verify GitLab token
	secret, err := h.getPipelineWebhookSecret(c, pipelineID, orgID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "pipeline not found"})
	}
	if secret != "" && c.Get("X-Gitlab-Token") != secret {
		return c.Status(401).JSON(fiber.Map{"error": "invalid token"})
	}

	event := c.Get("X-Gitlab-Event")
	var payload map[string]interface{}
	_ = json.Unmarshal(c.Body(), &payload)

	if strings.Contains(event, "Push") {
		branch := getStr(payload, "ref")
		branch = strings.TrimPrefix(branch, "refs/heads/")
		_ = h.triggerPipelineInternal(c, pipelineID, orgID, map[string]string{
			"trigger":  "webhook",
			"provider": "gitlab",
			"event":    event,
			"branch":   branch,
		})
	}

	return c.JSON(fiber.Map{"received": true})
}

func (h *PipelineHandler) getPipelineWebhookSecret(c *fiber.Ctx, pipelineID, orgID string) (string, error) {
	var secret string
	err := h.db.QueryRow(c.Context(),
		`SELECT COALESCE(webhook_secret,'') FROM pipelines WHERE id=$1 AND organization_id=$2`,
		pipelineID, orgID).Scan(&secret)
	return secret, err
}

func (h *PipelineHandler) triggerPipelineInternal(c *fiber.Ctx, pipelineID, orgID string, meta map[string]string) error {
	metaJSON, _ := json.Marshal(meta)
	_, err := h.db.Exec(c.Context(),
		`INSERT INTO pipeline_runs (pipeline_id, organization_id, status, trigger_metadata)
		 VALUES ($1,$2,'pending',$3)`, pipelineID, orgID, metaJSON)
	return err
}

func verifyGitHubSignature(payload []byte, sigHeader, secret string) bool {
	if !strings.HasPrefix(sigHeader, "sha256=") {
		// Fallback to sha1 for older hooks
		if strings.HasPrefix(sigHeader, "sha1=") {
			mac := hmac.New(sha1.New, []byte(secret))
			mac.Write(payload)
			expected := "sha1=" + hex.EncodeToString(mac.Sum(nil))
			return hmac.Equal([]byte(expected), []byte(sigHeader))
		}
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sigHeader))
}

func extractBranch(payload map[string]interface{}, event string) string {
	if event == "push" {
		ref, _ := payload["ref"].(string)
		return strings.TrimPrefix(ref, "refs/heads/")
	}
	return ""
}

func getStr(m map[string]interface{}, keys ...string) string {
	var cur interface{} = m
	for _, k := range keys {
		mp, ok := cur.(map[string]interface{})
		if !ok {
			return ""
		}
		cur = mp[k]
	}
	s, _ := cur.(string)
	return s
}

func getBool(m map[string]interface{}, keys ...string) bool {
	var cur interface{} = m
	for _, k := range keys {
		mp, ok := cur.(map[string]interface{})
		if !ok {
			return false
		}
		cur = mp[k]
	}
	b, _ := cur.(bool)
	return b
}
