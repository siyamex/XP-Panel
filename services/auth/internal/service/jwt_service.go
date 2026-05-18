package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
	ErrTokenRevoked = errors.New("token has been revoked")
)

type Claims struct {
	UserID    uuid.UUID `json:"sub"`
	OrgID     uuid.UUID `json:"org"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Roles     []string  `json:"roles"`
	Perms     []string  `json:"perms"`
	SessionID uuid.UUID `json:"sid"`
	MFADone   bool      `json:"mfa"`
	IsAPI     bool      `json:"api,omitempty"`
	Scopes    []string  `json:"scopes,omitempty"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secret        []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewJWTService(secret string, accessExpiry, refreshExpiry time.Duration) *JWTService {
	return &JWTService{
		secret:        []byte(secret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

func (s *JWTService) IssueTokenPair(user *domain.User, sessionID uuid.UUID, mfaDone bool) (*domain.TokenPair, string, error) {
	now := time.Now()
	accessExpiry := now.Add(s.accessExpiry)

	roles := make([]string, 0, len(user.Roles))
	perms := make([]string, 0)
	seen := map[string]bool{}
	for _, r := range user.Roles {
		roles = append(roles, r.Name)
		for _, p := range r.Permissions {
			if !seen[p] {
				seen[p] = true
				perms = append(perms, p)
			}
		}
	}

	claims := Claims{
		UserID:    user.ID,
		OrgID:     user.OrganizationID,
		Email:     user.Email,
		Username:  user.Username,
		Roles:     roles,
		Perms:     perms,
		SessionID: sessionID,
		MFADone:   mfaDone,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			Issuer:    "xp-panel",
			Subject:   user.ID.String(),
		},
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return nil, "", err
	}

	refreshToken, err := generateSecureToken(32)
	if err != nil {
		return nil, "", err
	}

	return &domain.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    accessExpiry,
		TokenType:    "Bearer",
	}, refreshToken, nil
}

func (s *JWTService) ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func generateSecureToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
