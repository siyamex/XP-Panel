package geoip

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

// Record holds the resolved location data for an IP address.
type Record struct {
	IP          string  `json:"ip"`
	CountryCode string  `json:"country_code"`
	CountryName string  `json:"country_name"`
	City        string  `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	ISP         string  `json:"isp"`
	ASN         string  `json:"asn"`
}

// Resolver looks up IP geolocation.
// It uses the MaxMind GeoIP2 Precision Web Services API when MAXMIND_ACCOUNT_ID
// and MAXMIND_LICENSE_KEY are set; otherwise falls back to the free ip-api.com service.
type Resolver struct {
	http      *http.Client
	accountID string
	licenseKey string
	cache     sync.Map // ip → *cachedRecord
}

type cachedRecord struct {
	rec    *Record
	expiry time.Time
}

const cacheTTL = 24 * time.Hour

func New() *Resolver {
	return &Resolver{
		http: &http.Client{Timeout: 5 * time.Second},
		accountID:  os.Getenv("MAXMIND_ACCOUNT_ID"),
		licenseKey: os.Getenv("MAXMIND_LICENSE_KEY"),
	}
}

// Lookup resolves an IP address to a geolocation record.
func (r *Resolver) Lookup(ctx context.Context, ip string) (*Record, error) {
	if net.ParseIP(ip) == nil {
		return nil, fmt.Errorf("invalid IP address: %s", ip)
	}

	// Check cache
	if v, ok := r.cache.Load(ip); ok {
		cached := v.(*cachedRecord)
		if time.Now().Before(cached.expiry) {
			return cached.rec, nil
		}
	}

	var rec *Record
	var err error

	if r.accountID != "" && r.licenseKey != "" {
		rec, err = r.lookupMaxMind(ctx, ip)
	} else {
		rec, err = r.lookupFallback(ctx, ip)
	}
	if err != nil {
		return nil, err
	}

	r.cache.Store(ip, &cachedRecord{rec: rec, expiry: time.Now().Add(cacheTTL)})
	return rec, nil
}

// lookupMaxMind queries the MaxMind GeoIP2 Precision Web Service.
func (r *Resolver) lookupMaxMind(ctx context.Context, ip string) (*Record, error) {
	url := fmt.Sprintf("https://geolite.info/geoip/v2.1/city/%s", ip)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.SetBasicAuth(r.accountID, r.licenseKey)
	req.Header.Set("Accept", "application/json")

	resp, err := r.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("maxmind request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("maxmind returned %d", resp.StatusCode)
	}

	var data struct {
		Country struct {
			ISOCode string            `json:"iso_code"`
			Names   map[string]string `json:"names"`
		} `json:"country"`
		City struct {
			Names map[string]string `json:"names"`
		} `json:"city"`
		Location struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"location"`
		Traits struct {
			ISP              string `json:"isp"`
			AutonomousSystem string `json:"autonomous_system_organization"`
			ASNumber         int    `json:"autonomous_system_number"`
		} `json:"traits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("maxmind decode: %w", err)
	}

	return &Record{
		IP:          ip,
		CountryCode: data.Country.ISOCode,
		CountryName: data.Country.Names["en"],
		City:        data.City.Names["en"],
		Latitude:    data.Location.Latitude,
		Longitude:   data.Location.Longitude,
		ISP:         data.Traits.ISP,
		ASN:         fmt.Sprintf("AS%d %s", data.Traits.ASNumber, data.Traits.AutonomousSystem),
	}, nil
}

// lookupFallback uses the free ip-api.com service (rate-limited to 45 req/min).
func (r *Resolver) lookupFallback(ctx context.Context, ip string) (*Record, error) {
	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,country,countryCode,city,lat,lon,isp,as", ip)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)

	resp, err := r.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ip-api request: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		Status      string  `json:"status"`
		Country     string  `json:"country"`
		CountryCode string  `json:"countryCode"`
		City        string  `json:"city"`
		Lat         float64 `json:"lat"`
		Lon         float64 `json:"lon"`
		ISP         string  `json:"isp"`
		AS          string  `json:"as"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("ip-api decode: %w", err)
	}
	if data.Status != "success" {
		return nil, fmt.Errorf("ip-api: lookup failed for %s", ip)
	}

	return &Record{
		IP:          ip,
		CountryCode: data.CountryCode,
		CountryName: data.Country,
		City:        data.City,
		Latitude:    data.Lat,
		Longitude:   data.Lon,
		ISP:         data.ISP,
		ASN:         data.AS,
	}, nil
}
