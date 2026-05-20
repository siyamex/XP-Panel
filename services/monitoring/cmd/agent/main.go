package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/xpanel/monitoring/internal/collector"
)

func main() {
	serverURL := flag.String("server", envOrDefault("MONITORING_URL", "http://localhost:8088"), "Monitoring service URL")
	apiKey := flag.String("key", envOrDefault("AGENT_KEY", ""), "Agent API key (from xp-panel server registration)")
	interval := flag.Duration("interval", 10*time.Second, "Collection interval")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("AGENT_KEY is required — register this server in XP-Panel and set the key")
	}

	log.Printf("XP-Panel Monitoring Agent starting (server=%s interval=%s)", *serverURL, *interval)

	client := &http.Client{Timeout: 10 * time.Second}
	endpoint := *serverURL + "/api/v1/agent/metrics"

	ticker := time.NewTicker(*interval)
	defer ticker.Stop()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Send immediately on start
	push(client, endpoint, *apiKey)

	for {
		select {
		case <-quit:
			log.Println("Agent shutting down")
			return
		case <-ticker.C:
			push(client, endpoint, *apiKey)
		}
	}
}

func push(client *http.Client, endpoint, apiKey string) {
	m, err := collector.Collect("agent")
	if err != nil {
		log.Printf("collect error: %v", err)
		return
	}

	body, err := json.Marshal(m)
	if err != nil {
		log.Printf("marshal error: %v", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		log.Printf("request build error: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Agent-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("push error: %v", err)
		return
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("push rejected: HTTP %d", resp.StatusCode)
	}
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
