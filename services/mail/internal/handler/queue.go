package handler

import (
	"bufio"
	"bytes"
	"os/exec"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type queueEntry struct {
	ID      string    `json:"id"`
	Size    string    `json:"size"`
	Date    time.Time `json:"date"`
	Sender  string    `json:"sender"`
	Rcpt    string    `json:"rcpt"`
	Status  string    `json:"status"`
}

func (h *Handler) ListMailQueue(c *fiber.Ctx) error {
	out, err := runMailq()
	if err != nil {
		// Return empty on error (mailq may not be installed in dev)
		return c.JSON(fiber.Map{"entries": []queueEntry{}, "total": 0})
	}
	entries := parseMailq(out)
	return c.JSON(fiber.Map{"entries": entries, "total": len(entries)})
}

func (h *Handler) FlushMailQueue(c *fiber.Ctx) error {
	cmd := exec.Command("postfix", "flush")
	if err := cmd.Run(); err != nil {
		// Try sendmail -q as fallback
		_ = exec.Command("sendmail", "-q").Run()
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteMailQueueEntry(c *fiber.Ctx) error {
	id := c.Params("id")
	// postsuper -d <id>
	cmd := exec.Command("postsuper", "-d", id)
	if err := cmd.Run(); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *Handler) DeleteAllMailQueue(c *fiber.Ctx) error {
	cmd := exec.Command("postsuper", "-d", "ALL")
	if err := cmd.Run(); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

func runMailq() (string, error) {
	var out bytes.Buffer
	cmd := exec.Command("mailq")
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		// Try postqueue as fallback
		cmd2 := exec.Command("postqueue", "-p")
		cmd2.Stdout = &out
		if err2 := cmd2.Run(); err2 != nil {
			return "", err2
		}
	}
	return out.String(), nil
}

func parseMailq(output string) []queueEntry {
	entries := []queueEntry{}
	scanner := bufio.NewScanner(strings.NewReader(output))
	var current *queueEntry

	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 || strings.HasPrefix(line, "-Queue ID-") || strings.HasPrefix(line, "Mail queue is empty") {
			continue
		}
		// Postfix queue line format: QUEUEID SIZE DATE SENDER
		if len(line) > 0 && line[0] != ' ' && line[0] != '\t' {
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				if current != nil {
					entries = append(entries, *current)
				}
				current = &queueEntry{
					ID:     strings.TrimSuffix(parts[0], "*"),
					Size:   parts[1],
					Sender: parts[len(parts)-1],
					Status: "queued",
					Date:   time.Now(),
				}
			}
		} else if current != nil && strings.Contains(line, "@") {
			current.Rcpt = strings.TrimSpace(line)
		}
	}
	if current != nil {
		entries = append(entries, *current)
	}
	return entries
}
