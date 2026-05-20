package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

type OAuthHandler struct {
	auth *service.AuthService
	jwt  *service.JWTService
	rdb  *redis.Client
}

func NewOAuthHandler(auth *service.AuthService, jwt *service.JWTService, rdb *redis.Client) *OAuthHandler {
	return &OAuthHandler{auth: auth, jwt: jwt, rdb: rdb}
}

var oauthProviders = map[string]oauthConfig{
	"github": {
		authURL:     "https://github.com/login/oauth/authorize",
		tokenURL:    "https://github.com/login/oauth/access_token",
		userInfoURL: "https://api.github.com/user",
		scopes:      "user:email",
	},
	"google": {
		authURL:     "https://accounts.google.com/o/oauth2/v2/auth",
		tokenURL:    "https://oauth2.googleapis.com/token",
		userInfoURL: "https://www.googleapis.com/oauth2/v2/userinfo",
		scopes:      "openid email profile",
	},
	"gitlab": {
		authURL:     "https://gitlab.com/oauth/authorize",
		tokenURL:    "https://gitlab.com/oauth/token",
		userInfoURL: "https://gitlab.com/api/v4/user",
		scopes:      "read_user email",
	},
}

type oauthConfig struct {
	authURL     string
	tokenURL    string
	userInfoURL string
	scopes      string
}

// GET /api/v1/auth/oauth/:provider
func (h *OAuthHandler) Redirect(c *fiber.Ctx) error {
	provider := c.Params("provider")
	cfg, ok := oauthProviders[provider]
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "unknown provider")
	}

	state := randomState()
	h.rdb.Set(c.Context(), "oauth:state:"+state, provider, 10*time.Minute)

	clientID := os.Getenv(fmt.Sprintf("OAUTH_%s_CLIENT_ID", strings.ToUpper(provider)))
	redirectURI := os.Getenv("OAUTH_REDIRECT_URI") + "/" + provider

	url := fmt.Sprintf("%s?client_id=%s&redirect_uri=%s&scope=%s&state=%s&response_type=code",
		cfg.authURL, clientID, redirectURI, cfg.scopes, state)

	return c.Redirect(url)
}

// GET /api/v1/auth/oauth/:provider/callback
func (h *OAuthHandler) Callback(c *fiber.Ctx) error {
	provider := c.Params("provider")
	cfg, ok := oauthProviders[provider]
	if !ok {
		return fiber.NewError(fiber.StatusBadRequest, "unknown provider")
	}

	state := c.Query("state")
	code := c.Query("code")

	// Validate state
	stored, err := h.rdb.GetDel(c.Context(), "oauth:state:"+state).Result()
	if err != nil || stored != provider {
		return fiber.NewError(fiber.StatusBadRequest, "invalid oauth state")
	}

	// Exchange code for token
	clientID := os.Getenv(fmt.Sprintf("OAUTH_%s_CLIENT_ID", strings.ToUpper(provider)))
	clientSecret := os.Getenv(fmt.Sprintf("OAUTH_%s_CLIENT_SECRET", strings.ToUpper(provider)))
	redirectURI := os.Getenv("OAUTH_REDIRECT_URI") + "/" + provider

	accessToken, err := exchangeCode(cfg, clientID, clientSecret, redirectURI, code)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "failed to exchange oauth code")
	}

	// Fetch user info
	profile, err := fetchUserInfo(cfg.userInfoURL, accessToken)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch user info")
	}

	email, _ := profile["email"].(string)
	if email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "oauth provider did not return email")
	}

	// Find or create user
	pair, err := h.auth.OAuthLogin(c.Context(), service.OAuthInput{
		Provider: provider,
		Email:    email,
		Name:     fmt.Sprintf("%v", profile["name"]),
		IP:       c.IP(),
		UA:       c.Get("User-Agent"),
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "oauth login failed")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	return c.Redirect(fmt.Sprintf("%s/auth/callback?access_token=%s&refresh_token=%s",
		frontendURL, pair.AccessToken, pair.RefreshToken))
}

func exchangeCode(cfg oauthConfig, clientID, clientSecret, redirectURI, code string) (string, error) {
	params := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"code":          {code},
		"grant_type":    {"authorization_code"},
	}
	req, err := http.NewRequest("POST", cfg.tokenURL, strings.NewReader(params.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)
	token, _ := result["access_token"].(string)
	if token == "" {
		return "", fmt.Errorf("no access token in response")
	}
	return token, nil
}

func fetchUserInfo(userInfoURL, token string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", userInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var profile map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&profile)
	return profile, nil
}

func randomState() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func toUpper(s string) string {
	result := make([]byte, len(s))
	for i := range s {
		if s[i] >= 'a' && s[i] <= 'z' {
			result[i] = s[i] - 32
		} else {
			result[i] = s[i]
		}
	}
	return string(result)
}

