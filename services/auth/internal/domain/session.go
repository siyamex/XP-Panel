package domain

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	ID                uuid.UUID `db:"id"`
	UserID            uuid.UUID `db:"user_id"`
	TokenHash         string    `db:"token_hash"`
	RefreshTokenHash  *string   `db:"refresh_token_hash"`
	IPAddress         *string   `db:"ip_address"`
	UserAgent         *string   `db:"user_agent"`
	DeviceFingerprint *string   `db:"device_fingerprint"`
	ExpiresAt         time.Time `db:"expires_at"`
	LastActiveAt      time.Time `db:"last_active_at"`
	CreatedAt         time.Time `db:"created_at"`
}

type APIToken struct {
	ID        uuid.UUID  `db:"id"          json:"id"`
	UserID    uuid.UUID  `db:"user_id"      json:"userId"`
	Name      string     `db:"name"         json:"name"`
	TokenHash string     `db:"token_hash"   json:"-"`
	Scopes    []string   `db:"scopes"       json:"scopes"`
	LastUsedAt *time.Time `db:"last_used_at" json:"lastUsedAt"`
	ExpiresAt  *time.Time `db:"expires_at"   json:"expiresAt"`
	CreatedAt  time.Time  `db:"created_at"   json:"createdAt"`
}

type Passkey struct {
	ID           uuid.UUID `db:"id"`
	UserID       uuid.UUID `db:"user_id"`
	CredentialID string    `db:"credential_id"`
	PublicKey    []byte    `db:"public_key"`
	AAGUID       string    `db:"aaguid"`
	SignCount     uint32    `db:"sign_count"`
	DeviceName   *string   `db:"device_name"`
	CreatedAt    time.Time `db:"created_at"`
}

type TokenPair struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
	TokenType    string    `json:"tokenType"`
}
