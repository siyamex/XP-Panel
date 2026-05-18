package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type PowerDNS struct {
	baseURL string
	apiKey  string
	server  string
	client  *http.Client
}

func NewPowerDNS(baseURL, apiKey, server string) *PowerDNS {
	return &PowerDNS{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		server:  server,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// pdnsZone is the PowerDNS API zone representation
type pdnsZone struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Kind           string     `json:"kind"`
	Serial         int        `json:"serial"`
	Nameservers    []string   `json:"nameservers"`
	ResourceRecordSets []pdnsRRSet `json:"rrsets,omitempty"`
}

type pdnsRRSet struct {
	Name       string      `json:"name"`
	Type       string      `json:"type"`
	TTL        int         `json:"ttl"`
	ChangeType string      `json:"changetype,omitempty"`
	Records    []pdnsRecord `json:"records"`
}

type pdnsRecord struct {
	Content  string `json:"content"`
	Disabled bool   `json:"disabled"`
}

func (p *PowerDNS) CreateZone(name, kind string, nameservers []string) (string, error) {
	if !strings.HasSuffix(name, ".") {
		name = name + "."
	}
	if len(nameservers) == 0 {
		nameservers = []string{"ns1.example.com.", "ns2.example.com."}
	}

	zone := pdnsZone{
		Name:        name,
		Kind:        kind,
		Nameservers: nameservers,
	}

	body, err := json.Marshal(zone)
	if err != nil {
		return "", err
	}

	resp, err := p.do("POST", fmt.Sprintf("/servers/%s/zones", p.server), body)
	if err != nil {
		return "", err
	}

	var created pdnsZone
	if err := json.Unmarshal(resp, &created); err != nil {
		return "", err
	}
	return created.ID, nil
}

func (p *PowerDNS) DeleteZone(zoneID string) error {
	_, err := p.do("DELETE", fmt.Sprintf("/servers/%s/zones/%s", p.server, zoneID), nil)
	return err
}

func (p *PowerDNS) UpsertRecord(zoneID, name, recType, content string, ttl, priority int, disabled bool) error {
	if !strings.HasSuffix(name, ".") {
		name = name + "."
	}

	// For MX/SRV, prepend priority to content
	fullContent := content
	if (recType == "MX" || recType == "SRV") && priority > 0 {
		fullContent = fmt.Sprintf("%d %s", priority, content)
	}

	patch := map[string]interface{}{
		"rrsets": []pdnsRRSet{
			{
				Name:       name,
				Type:       recType,
				TTL:        ttl,
				ChangeType: "REPLACE",
				Records: []pdnsRecord{
					{Content: fullContent, Disabled: disabled},
				},
			},
		},
	}

	body, _ := json.Marshal(patch)
	_, err := p.do("PATCH", fmt.Sprintf("/servers/%s/zones/%s", p.server, zoneID), body)
	return err
}

func (p *PowerDNS) DeleteRecord(zoneID, name, recType string) error {
	if !strings.HasSuffix(name, ".") {
		name = name + "."
	}

	patch := map[string]interface{}{
		"rrsets": []pdnsRRSet{
			{Name: name, Type: recType, ChangeType: "DELETE"},
		},
	}

	body, _ := json.Marshal(patch)
	_, err := p.do("PATCH", fmt.Sprintf("/servers/%s/zones/%s", p.server, zoneID), body)
	return err
}

func (p *PowerDNS) do(method, path string, body []byte) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, p.baseURL+"/api/v1"+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("powerdns error %d: %s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}
