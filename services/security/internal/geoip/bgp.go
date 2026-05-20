package geoip

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ASNInfo holds BGP/ASN data fetched from the RIPE NCC RIS API.
type ASNInfo struct {
	ASN         int      `json:"asn"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Country     string   `json:"country"`
	Prefixes    []string `json:"prefixes"`
	PeerCount   int      `json:"peer_count"`
}

// BGPMonitor queries RIPE NCC RIS (Routing Information Service) for ASN data.
type BGPMonitor struct {
	http *http.Client
}

func NewBGPMonitor() *BGPMonitor {
	return &BGPMonitor{http: &http.Client{Timeout: 10 * time.Second}}
}

// LookupASN fetches details for a given Autonomous System Number.
func (b *BGPMonitor) LookupASN(ctx context.Context, asn int) (*ASNInfo, error) {
	url := fmt.Sprintf("https://stat.ripe.net/data/as-overview/data.json?resource=AS%d", asn)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "xp-panel/1.0")

	resp, err := b.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RIPE API request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status string `json:"status"`
		Data   struct {
			Resource string `json:"resource"`
			Holder   string `json:"holder"`
			Announced bool  `json:"announced"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("RIPE API decode: %w", err)
	}
	if result.Status != "ok" {
		return nil, fmt.Errorf("RIPE API returned status: %s", result.Status)
	}

	// Fetch announced prefixes
	prefixes, _ := b.fetchPrefixes(ctx, asn)

	return &ASNInfo{
		ASN:         asn,
		Name:        result.Data.Resource,
		Description: result.Data.Holder,
		Prefixes:    prefixes,
	}, nil
}

// LookupIPRoute finds the BGP route for a given IP address.
func (b *BGPMonitor) LookupIPRoute(ctx context.Context, ip string) ([]RouteEntry, error) {
	url := fmt.Sprintf("https://stat.ripe.net/data/prefix-routing-consistency/data.json?resource=%s", ip)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "xp-panel/1.0")

	resp, err := b.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RIPE route request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status string `json:"status"`
		Data   struct {
			Routes []struct {
				Prefix string `json:"prefix"`
				Origin string `json:"origin"`
			} `json:"routes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("RIPE route decode: %w", err)
	}

	entries := make([]RouteEntry, 0, len(result.Data.Routes))
	for _, r := range result.Data.Routes {
		entries = append(entries, RouteEntry{Prefix: r.Prefix, Origin: r.Origin})
	}
	return entries, nil
}

// RouteEntry is a single BGP route prefix.
type RouteEntry struct {
	Prefix string `json:"prefix"`
	Origin string `json:"origin"`
}

func (b *BGPMonitor) fetchPrefixes(ctx context.Context, asn int) ([]string, error) {
	url := fmt.Sprintf("https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS%d", asn)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "xp-panel/1.0")

	resp, err := b.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data struct {
			Prefixes []struct {
				Prefix string `json:"prefix"`
			} `json:"prefixes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(result.Data.Prefixes))
	for _, p := range result.Data.Prefixes {
		out = append(out, p.Prefix)
	}
	return out, nil
}
