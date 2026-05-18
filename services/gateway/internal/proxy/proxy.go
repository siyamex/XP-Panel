package proxy

import (
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

// ServiceProxy reverse-proxies a request to an upstream service.
type ServiceProxy struct {
	client *fasthttp.Client
}

func New() *ServiceProxy {
	return &ServiceProxy{
		client: &fasthttp.Client{
			MaxConnsPerHost:     512,
			ReadTimeout:         30e9,  // 30s
			WriteTimeout:        30e9,
			MaxIdleConnDuration: 60e9,
		},
	}
}

// To returns a Fiber handler that proxies to the given upstream URL prefix.
func (p *ServiceProxy) To(upstream string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Build upstream URL: upstream + original path + query
		targetURL := upstream + c.OriginalURL()

		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		defer fasthttp.ReleaseRequest(req)
		defer fasthttp.ReleaseResponse(resp)

		// Copy incoming request
		c.Request().CopyTo(req)
		req.SetRequestURI(targetURL)
		req.Header.SetMethod(string(c.Method()))

		// Forward X-* context headers (set by auth middleware)
		req.Header.Set("X-User-ID", c.Get("X-User-ID"))
		req.Header.Set("X-Org-ID", c.Get("X-Org-ID"))
		req.Header.Set("X-User-Email", c.Get("X-User-Email"))
		req.Header.Set("X-User-Roles", c.Get("X-User-Roles"))
		req.Header.Set("X-Forwarded-For", c.IP())
		req.Header.Set("X-Request-ID", c.GetRespHeader("X-Request-ID", c.Get("X-Request-ID")))

		if err := p.client.Do(req, resp); err != nil {
			return fiber.NewError(fiber.StatusBadGateway, "upstream service unavailable")
		}

		// Copy upstream response back
		c.Status(resp.StatusCode())
		resp.Header.VisitAll(func(k, v []byte) {
			c.Set(string(k), string(v))
		})

		return c.Send(resp.Body())
	}
}

// SSETo proxies Server-Sent Events (streaming) to an upstream service.
func (p *ServiceProxy) SSETo(upstream string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		targetURL := upstream + c.OriginalURL()

		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		c.Set("X-Accel-Buffering", "no")

		req := fasthttp.AcquireRequest()
		resp := fasthttp.AcquireResponse()
		defer fasthttp.ReleaseRequest(req)
		defer fasthttp.ReleaseResponse(resp)

		c.Request().CopyTo(req)
		req.SetRequestURI(targetURL)
		req.Header.Set("X-User-ID", c.Get("X-User-ID"))
		req.Header.Set("X-Org-ID", c.Get("X-Org-ID"))

		resp.StreamBody = true
		if err := p.client.Do(req, resp); err != nil {
			return fiber.NewError(fiber.StatusBadGateway, "upstream SSE unavailable")
		}

		c.Status(resp.StatusCode())
		return c.Send(resp.Body())
	}
}
