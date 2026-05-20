package provider

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strings"
)

type EmailProvider struct {
	host     string
	port     string
	username string
	password string
	from     string
}

func NewEmailProvider() *EmailProvider {
	return &EmailProvider{
		host:     os.Getenv("SMTP_HOST"),
		port:     getEnvOrDefault("SMTP_PORT", "587"),
		username: os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASS"),
		from:     getEnvOrDefault("SMTP_FROM", "noreply@xp-panel.io"),
	}
}

func (p *EmailProvider) Send(to, subject, body string) error {
	if p.host == "" {
		return nil // not configured — silently skip
	}

	addr := net.JoinHostPort(p.host, p.port)
	auth := smtp.PlainAuth("", p.username, p.password, p.host)

	msg := strings.Join([]string{
		fmt.Sprintf("From: XP-Panel <%s>", p.from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"",
		body,
	}, "\r\n")

	// Try STARTTLS first, fall back to plain
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, p.host)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: p.host}); err != nil {
			return err
		}
	}
	if p.username != "" {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(p.from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	w, err := client.Data()
	if err != nil {
		return err
	}
	defer w.Close()
	_, err = fmt.Fprint(w, msg)
	return err
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
