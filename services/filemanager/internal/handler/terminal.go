package handler

import (
	"bufio"
	"encoding/json"
	"io"
	"log"
	"net"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"golang.org/x/crypto/ssh"
)

type terminalMsg struct {
	Type string `json:"type"` // input | resize | ping
	Data string `json:"data"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

// SSHTerminalWS handles WebSocket-based SSH terminal sessions
func SSHTerminalWS(c *websocket.Conn) {
	host := c.Query("host", "localhost")
	port := c.Query("port", "22")
	user := c.Query("user", "root")
	authMethod := c.Query("auth", "key") // key | password
	password := c.Query("password", "")

	// Build SSH client config
	var auths []ssh.AuthMethod
	if authMethod == "password" && password != "" {
		auths = append(auths, ssh.Password(password))
	} else {
		// Try system SSH agent or default key
		keyPath := os.ExpandEnv("$HOME/.ssh/id_rsa")
		if key, err := os.ReadFile(keyPath); err == nil {
			if signer, err := ssh.ParsePrivateKey(key); err == nil {
				auths = append(auths, ssh.PublicKeys(signer))
			}
		}
	}
	if len(auths) == 0 {
		_ = c.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","data":"no auth method available"}`))
		return
	}

	config := &ssh.ClientConfig{
		User:            user,
		Auth:            auths,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	conn, err := net.DialTimeout("tcp", host+":"+port, 10*time.Second)
	if err != nil {
		errMsg, _ := json.Marshal(map[string]string{"type": "error", "data": "connect failed: " + err.Error()})
		_ = c.WriteMessage(websocket.TextMessage, errMsg)
		return
	}
	defer conn.Close()

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, host, config)
	if err != nil {
		errMsg, _ := json.Marshal(map[string]string{"type": "error", "data": "ssh handshake failed: " + err.Error()})
		_ = c.WriteMessage(websocket.TextMessage, errMsg)
		return
	}
	client := ssh.NewClient(sshConn, chans, reqs)
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		errMsg, _ := json.Marshal(map[string]string{"type": "error", "data": "session failed"})
		_ = c.WriteMessage(websocket.TextMessage, errMsg)
		return
	}
	defer session.Close()

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		log.Printf("pty request failed: %v", err)
	}

	stdin, _ := session.StdinPipe()
	stdout, _ := session.StdoutPipe()
	stderr, _ := session.StderrPipe()

	if err := session.Shell(); err != nil {
		errMsg, _ := json.Marshal(map[string]string{"type": "error", "data": "shell start failed"})
		_ = c.WriteMessage(websocket.TextMessage, errMsg)
		return
	}

	// Stream stdout/stderr to WebSocket
	go streamOutput(c, stdout)
	go streamOutput(c, stderr)

	// Read from WebSocket → send to SSH stdin
	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			break
		}
		var tm terminalMsg
		if err := json.Unmarshal(msg, &tm); err != nil {
			_, _ = stdin.Write(msg)
			continue
		}
		switch tm.Type {
		case "input":
			_, _ = stdin.Write([]byte(tm.Data))
		case "resize":
			_ = session.WindowChange(tm.Rows, tm.Cols)
		}
	}
}

func streamOutput(c *websocket.Conn, r io.Reader) {
	buf := bufio.NewReader(r)
	tmp := make([]byte, 4096)
	for {
		n, err := buf.Read(tmp)
		if n > 0 {
			out, _ := json.Marshal(map[string]string{"type": "output", "data": string(tmp[:n])})
			if writeErr := c.WriteMessage(websocket.TextMessage, out); writeErr != nil {
				return
			}
		}
		if err != nil {
			return
		}
	}
}

// TerminalHTTPUpgrade upgrades HTTP → WebSocket for the terminal
func TerminalHTTPUpgrade(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}
