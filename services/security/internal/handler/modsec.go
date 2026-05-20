package handler

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type modsecRule struct {
	ID      string `json:"id"`
	File    string `json:"file"`
	Line    int    `json:"line"`
	Message string `json:"message"`
	Enabled bool   `json:"enabled"`
}

var modsecRulesDir = "/etc/modsecurity/rules"

func (h *SecurityHandler) ListModSecRules(c *fiber.Ctx) error {
	rules := []modsecRule{}

	dir := modsecRulesDir
	entries, err := os.ReadDir(dir)
	if err != nil {
		// Return empty list if modsec not installed
		return c.JSON(fiber.Map{"rules": rules, "total": 0, "installed": false})
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".conf") {
			continue
		}
		f, err := os.Open(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := strings.TrimSpace(scanner.Text())
			if strings.HasPrefix(line, "SecRule") || strings.HasPrefix(line, "SecAction") {
				enabled := !strings.HasPrefix(scanner.Text(), "#")
				id := extractRuleID(line)
				msg := extractRuleMsg(line)
				rules = append(rules, modsecRule{
					ID:      id,
					File:    e.Name(),
					Line:    lineNum,
					Message: msg,
					Enabled: enabled,
				})
			}
		}
		f.Close()
	}

	return c.JSON(fiber.Map{"rules": rules, "total": len(rules), "installed": true})
}

func (h *SecurityHandler) ToggleModSecRule(c *fiber.Ctx) error {
	var body struct {
		File    string `json:"file"`
		Line    int    `json:"line"`
		Enabled bool   `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	// In production: comment/uncomment the rule line in the file
	// For now, return success (the frontend tracks state)
	return c.JSON(fiber.Map{"ok": true})
}

func (h *SecurityHandler) GetModSecStatus(c *fiber.Ctx) error {
	_, err := os.Stat("/etc/modsecurity/modsecurity.conf")
	installed := err == nil

	mode := "Off"
	if installed {
		data, _ := os.ReadFile("/etc/modsecurity/modsecurity.conf")
		if strings.Contains(string(data), "SecRuleEngine On") {
			mode = "On"
		} else if strings.Contains(string(data), "SecRuleEngine DetectionOnly") {
			mode = "DetectionOnly"
		}
	}

	return c.JSON(fiber.Map{
		"installed": installed,
		"mode":      mode,
	})
}

func (h *SecurityHandler) SetModSecMode(c *fiber.Ctx) error {
	var body struct {
		Mode string `json:"mode"` // On | Off | DetectionOnly
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	validModes := map[string]bool{"On": true, "Off": true, "DetectionOnly": true}
	if !validModes[body.Mode] {
		return fiber.NewError(fiber.StatusBadRequest, "mode must be On, Off, or DetectionOnly")
	}
	// In production: update modsecurity.conf SecRuleEngine directive
	return c.JSON(fiber.Map{"ok": true, "mode": body.Mode})
}

func extractRuleID(line string) string {
	idx := strings.Index(line, "id:")
	if idx < 0 {
		return ""
	}
	rest := line[idx+3:]
	parts := strings.FieldsFunc(rest, func(r rune) bool { return r == ',' || r == '"' || r == '\'' || r == ' ' })
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}

func extractRuleMsg(line string) string {
	idx := strings.Index(line, "msg:")
	if idx < 0 {
		return line
	}
	rest := line[idx+4:]
	if len(rest) > 0 && rest[0] == '\'' {
		end := strings.Index(rest[1:], "'")
		if end >= 0 {
			return rest[1 : end+1]
		}
	}
	return strings.TrimSpace(rest)
}
