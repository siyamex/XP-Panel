package handler

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xpanel/security/internal/geoip"
)

var (
	geoResolver = geoip.New()
	bgpMonitor  = geoip.NewBGPMonitor()
)

type GeoIPBlock struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	CountryCode    string    `json:"country_code"`
	CountryName    string    `json:"country_name"`
	Action         string    `json:"action"` // block | log
	CreatedAt      time.Time `json:"created_at"`
}

// GET /security/geoip
func (h *SecurityHandler) ListGeoIPBlocks(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	rows, err := h.pool.Query(c.Context(),
		`SELECT id, organization_id, country_code, country_name, action, created_at
		 FROM geoip_blocks WHERE organization_id=$1 ORDER BY country_name`, orgID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	blocks := []GeoIPBlock{}
	for rows.Next() {
		var b GeoIPBlock
		if err := rows.Scan(&b.ID, &b.OrganizationID, &b.CountryCode, &b.CountryName, &b.Action, &b.CreatedAt); err != nil {
			continue
		}
		blocks = append(blocks, b)
	}
	return c.JSON(fiber.Map{"blocks": blocks, "total": len(blocks)})
}

// POST /security/geoip
func (h *SecurityHandler) AddGeoIPBlock(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	var req struct {
		CountryCode string `json:"country_code"`
		CountryName string `json:"country_name"`
		Action      string `json:"action"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	req.CountryCode = strings.ToUpper(req.CountryCode)
	if len(req.CountryCode) != 2 {
		return c.Status(400).JSON(fiber.Map{"error": "country_code must be 2-letter ISO code"})
	}
	if req.Action == "" {
		req.Action = "block"
	}

	var id string
	err := h.pool.QueryRow(c.Context(),
		`INSERT INTO geoip_blocks (organization_id, country_code, country_name, action)
		 VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, country_code) DO UPDATE SET action=$4
		 RETURNING id`, orgID, req.CountryCode, req.CountryName, req.Action,
	).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"id": id})
}

// DELETE /security/geoip/:countryCode
func (h *SecurityHandler) RemoveGeoIPBlock(c *fiber.Ctx) error {
	orgID := c.Get("X-Org-ID", "default")
	code := strings.ToUpper(c.Params("countryCode"))
	h.pool.Exec(c.Context(),
		`DELETE FROM geoip_blocks WHERE organization_id=$1 AND country_code=$2`, orgID, code)
	return c.SendStatus(204)
}

// GET /security/geoip/lookup?ip=1.2.3.4
func (h *SecurityHandler) LookupGeoIP(c *fiber.Ctx) error {
	ip := c.Query("ip")
	if ip == "" {
		ip = c.IP()
	}

	rec, err := geoResolver.Lookup(c.Context(), ip)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rec)
}

// GET /security/bgp/asn/:asn
func (h *SecurityHandler) LookupASN(c *fiber.Ctx) error {
	var asn int
	if _, err := fmt.Sscanf(c.Params("asn"), "%d", &asn); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid ASN"})
	}
	info, err := bgpMonitor.LookupASN(c.Context(), asn)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(info)
}

// GET /security/bgp/route?ip=1.2.3.4
func (h *SecurityHandler) LookupBGPRoute(c *fiber.Ctx) error {
	ip := c.Query("ip")
	if ip == "" {
		return c.Status(400).JSON(fiber.Map{"error": "ip is required"})
	}
	routes, err := bgpMonitor.LookupIPRoute(c.Context(), ip)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ip": ip, "routes": routes})
}
