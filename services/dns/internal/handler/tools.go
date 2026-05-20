package handler

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xp-panel/xp-panel/services/dns/internal/domain"
)

// DNS template definitions
var dnsTemplates = map[string][]domain.RecordTemplate{
	"wordpress": {
		{Type: "A", Name: "@", Value: "{{SERVER_IP}}", TTL: 3600},
		{Type: "A", Name: "www", Value: "{{SERVER_IP}}", TTL: 3600},
		{Type: "CNAME", Name: "mail", Value: "{{DOMAIN}}", TTL: 3600},
		{Type: "MX", Name: "@", Value: "mail.{{DOMAIN}}", TTL: 3600, Priority: 10},
		{Type: "TXT", Name: "@", Value: "v=spf1 a mx ~all", TTL: 3600},
	},
	"google_workspace": {
		{Type: "MX", Name: "@", Value: "aspmx.l.google.com", TTL: 3600, Priority: 1},
		{Type: "MX", Name: "@", Value: "alt1.aspmx.l.google.com", TTL: 3600, Priority: 5},
		{Type: "MX", Name: "@", Value: "alt2.aspmx.l.google.com", TTL: 3600, Priority: 5},
		{Type: "MX", Name: "@", Value: "alt3.aspmx.l.google.com", TTL: 3600, Priority: 10},
		{Type: "MX", Name: "@", Value: "alt4.aspmx.l.google.com", TTL: 3600, Priority: 10},
		{Type: "TXT", Name: "@", Value: "v=spf1 include:_spf.google.com ~all", TTL: 3600},
	},
	"microsoft_365": {
		{Type: "MX", Name: "@", Value: "{{ORG}}.mail.protection.outlook.com", TTL: 3600, Priority: 0},
		{Type: "CNAME", Name: "autodiscover", Value: "autodiscover.outlook.com", TTL: 3600},
		{Type: "CNAME", Name: "enterpriseregistration", Value: "enterpriseregistration.windows.net", TTL: 3600},
		{Type: "TXT", Name: "@", Value: "v=spf1 include:spf.protection.outlook.com -all", TTL: 3600},
	},
	"cloudflare": {
		{Type: "A", Name: "@", Value: "{{SERVER_IP}}", TTL: 1, Proxied: true},
		{Type: "A", Name: "www", Value: "{{SERVER_IP}}", TTL: 1, Proxied: true},
	},
	"basic": {
		{Type: "A", Name: "@", Value: "{{SERVER_IP}}", TTL: 3600},
		{Type: "A", Name: "www", Value: "{{SERVER_IP}}", TTL: 3600},
		{Type: "TXT", Name: "@", Value: "v=spf1 a mx ~all", TTL: 3600},
	},
}

// GET /api/v1/dns/templates
func ListTemplates(c *fiber.Ctx) error {
	type templateInfo struct {
		ID      string                  `json:"id"`
		Name    string                  `json:"name"`
		Records []domain.RecordTemplate `json:"records"`
	}
	names := map[string]string{
		"basic":            "Basic Website",
		"wordpress":        "WordPress / cPanel",
		"google_workspace": "Google Workspace",
		"microsoft_365":    "Microsoft 365",
		"cloudflare":       "Cloudflare Proxy",
	}
	list := []templateInfo{}
	for id, records := range dnsTemplates {
		list = append(list, templateInfo{ID: id, Name: names[id], Records: records})
	}
	return c.JSON(fiber.Map{"templates": list})
}

// GET /api/v1/dns/propagation?domain=example.com&type=A
func CheckPropagation(c *fiber.Ctx) error {
	domainName := c.Query("domain")
	recordType := strings.ToUpper(c.Query("type", "A"))
	if domainName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "domain is required"})
	}

	// Public DNS resolvers to check propagation from different locations
	resolvers := []struct {
		Name     string
		Server   string
		Location string
	}{
		{"Google", "8.8.8.8:53", "Mountain View, US"},
		{"Cloudflare", "1.1.1.1:53", "Global"},
		{"OpenDNS", "208.67.222.222:53", "San Jose, US"},
		{"Quad9", "9.9.9.9:53", "Zurich, CH"},
		{"Level3", "4.2.2.2:53", "Monroe, US"},
	}

	type result struct {
		Resolver string   `json:"resolver"`
		Location string   `json:"location"`
		Values   []string `json:"values"`
		Error    string   `json:"error,omitempty"`
		OK       bool     `json:"ok"`
	}

	results := make([]result, 0, len(resolvers))
	ch := make(chan result, len(resolvers))

	for _, r := range resolvers {
		go func(resolver, server, location string) {
			values, err := queryDNS(domainName, recordType, server)
			if err != nil {
				ch <- result{Resolver: resolver, Location: location, Error: err.Error(), OK: false}
				return
			}
			ch <- result{Resolver: resolver, Location: location, Values: values, OK: true}
		}(r.Name, r.Server, r.Location)
	}

	timeout := time.After(8 * time.Second)
	for i := 0; i < len(resolvers); i++ {
		select {
		case r := <-ch:
			results = append(results, r)
		case <-timeout:
			break
		}
	}

	propagated := 0
	for _, r := range results {
		if r.OK && len(r.Values) > 0 {
			propagated++
		}
	}

	return c.JSON(fiber.Map{
		"domain":      domainName,
		"type":        recordType,
		"results":     results,
		"propagated":  propagated,
		"total":       len(results),
		"percentage":  fmt.Sprintf("%.0f%%", float64(propagated)/float64(len(results))*100),
	})
}

func queryDNS(domainName, recordType, server string) ([]string, error) {
	r := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			d := net.Dialer{Timeout: 5 * time.Second}
			return d.DialContext(ctx, "udp", server)
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	switch recordType {
	case "A":
		addrs, err := r.LookupHost(ctx, domainName)
		if err != nil {
			return nil, err
		}
		// Filter IPv4 only
		var v4 []string
		for _, a := range addrs {
			if ip := net.ParseIP(a); ip != nil && ip.To4() != nil {
				v4 = append(v4, a)
			}
		}
		return v4, nil
	case "AAAA":
		addrs, err := r.LookupHost(ctx, domainName)
		if err != nil {
			return nil, err
		}
		var v6 []string
		for _, a := range addrs {
			if ip := net.ParseIP(a); ip != nil && ip.To4() == nil {
				v6 = append(v6, a)
			}
		}
		return v6, nil
	case "MX":
		mxs, err := r.LookupMX(ctx, domainName)
		if err != nil {
			return nil, err
		}
		var vals []string
		for _, mx := range mxs {
			vals = append(vals, fmt.Sprintf("%d %s", mx.Pref, mx.Host))
		}
		return vals, nil
	case "TXT":
		txts, err := r.LookupTXT(ctx, domainName)
		if err != nil {
			return nil, err
		}
		return txts, nil
	case "NS":
		nss, err := r.LookupNS(ctx, domainName)
		if err != nil {
			return nil, err
		}
		var vals []string
		for _, ns := range nss {
			vals = append(vals, ns.Host)
		}
		return vals, nil
	case "CNAME":
		cname, err := r.LookupCNAME(ctx, domainName)
		if err != nil {
			return nil, err
		}
		return []string{cname}, nil
	default:
		return nil, fmt.Errorf("unsupported record type: %s", recordType)
	}
}
