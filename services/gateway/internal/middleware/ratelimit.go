package middleware

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

// RateLimit applies a sliding-window rate limit using Redis.
// key is a function that returns the rate-limit key for the request
// (e.g., by IP or by user ID).
func RateLimit(rdb *redis.Client, requests int, window time.Duration, keyFn func(*fiber.Ctx) string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := "rl:" + keyFn(c)
		now := time.Now()
		windowStart := now.Add(-window)

		pipe := rdb.Pipeline()
		// Remove old entries outside the window
		pipe.ZRemRangeByScore(c.Context(), key, "0", strconv.FormatInt(windowStart.UnixMilli(), 10))
		// Count remaining
		countCmd := pipe.ZCard(c.Context(), key)
		// Add current request
		pipe.ZAdd(c.Context(), key, redis.Z{Score: float64(now.UnixMilli()), Member: fmt.Sprintf("%d", now.UnixNano())})
		// Set expiry
		pipe.Expire(c.Context(), key, window+time.Second)

		if _, err := pipe.Exec(c.Context()); err != nil {
			// On Redis failure, allow the request through (fail open)
			return c.Next()
		}

		count := countCmd.Val()
		remaining := int64(requests) - count

		c.Set("X-RateLimit-Limit", strconv.Itoa(requests))
		c.Set("X-RateLimit-Remaining", strconv.FormatInt(max(0, remaining), 10))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(now.Add(window).Unix(), 10))

		if count >= int64(requests) {
			return fiber.NewError(fiber.StatusTooManyRequests, "rate limit exceeded")
		}

		return c.Next()
	}
}

// IPKey returns the client IP as the rate-limit key.
func IPKey(c *fiber.Ctx) string { return c.IP() }

// UserKey returns the user ID as the rate-limit key (requires JWTAuth first).
func UserKey(c *fiber.Ctx) string {
	if rctx, ok := c.Locals("ctx").(*RequestContext); ok {
		return rctx.UserID.String()
	}
	return c.IP()
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
