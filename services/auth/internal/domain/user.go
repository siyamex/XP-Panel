package domain

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusSuspended UserStatus = "suspended"
	UserStatusPending   UserStatus = "pending"
	UserStatusLocked    UserStatus = "locked"
)

type MFAType string

const (
	MFATypeTOTP     MFAType = "totp"
	MFATypeSMS      MFAType = "sms"
	MFATypeWebAuthn MFAType = "webauthn"
)

type User struct {
	ID               uuid.UUID  `db:"id"                 json:"id"`
	OrganizationID   uuid.UUID  `db:"organization_id"    json:"organizationId"`
	Email            string     `db:"email"              json:"email"`
	EmailVerified    bool       `db:"email_verified"     json:"emailVerified"`
	Username         string     `db:"username"           json:"username"`
	PasswordHash     *string    `db:"password_hash"      json:"-"`
	FirstName        *string    `db:"first_name"         json:"firstName"`
	LastName         *string    `db:"last_name"          json:"lastName"`
	Status           UserStatus `db:"status"             json:"status"`
	FailedLoginCount int16      `db:"failed_login_count" json:"-"`
	LockedUntil      *time.Time `db:"locked_until"       json:"-"`
	LastLoginAt      *time.Time `db:"last_login_at"      json:"lastLoginAt"`
	MFAEnabled       bool       `db:"mfa_enabled"        json:"mfaEnabled"`
	MFAType          *MFAType   `db:"mfa_type"           json:"mfaType"`
	MFASecret        *string    `db:"mfa_secret"         json:"-"`
	PasskeyEnabled   bool       `db:"passkey_enabled"    json:"passkeyEnabled"`
	Timezone         string     `db:"timezone"           json:"timezone"`
	Language         string     `db:"language"           json:"language"`
	CreatedAt        time.Time  `db:"created_at"         json:"createdAt"`
	UpdatedAt        time.Time  `db:"updated_at"         json:"updatedAt"`

	Roles []Role `db:"-" json:"roles,omitempty"`
}

type Role struct {
	ID             uuid.UUID `db:"id"              json:"id"`
	OrganizationID *uuid.UUID `db:"organization_id" json:"organizationId"`
	Name           string    `db:"name"            json:"name"`
	IsSystem       bool      `db:"is_system"       json:"isSystem"`
	Permissions    []string  `db:"permissions"     json:"permissions"`
}

type Organization struct {
	ID                 uuid.UUID  `db:"id"                   json:"id"`
	Name               string     `db:"name"                 json:"name"`
	Slug               string     `db:"slug"                 json:"slug"`
	OwnerID            *uuid.UUID `db:"owner_id"             json:"ownerId"`
	WhiteLabelDomain   *string    `db:"white_label_domain"   json:"whiteLabelDomain"`
	LogoURL            *string    `db:"logo_url"             json:"logoUrl"`
	Status             string     `db:"status"               json:"status"`
	CreatedAt          time.Time  `db:"created_at"           json:"createdAt"`
}

// UserProfile is the safe public representation returned from /me
type UserProfile struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organizationId"`
	Email          string     `json:"email"`
	EmailVerified  bool       `json:"emailVerified"`
	Username       string     `json:"username"`
	FirstName      *string    `json:"firstName"`
	LastName       *string    `json:"lastName"`
	Status         UserStatus `json:"status"`
	MFAEnabled     bool       `json:"mfaEnabled"`
	MFAType        *MFAType   `json:"mfaType"`
	PasskeyEnabled bool       `json:"passkeyEnabled"`
	Timezone       string     `json:"timezone"`
	Language       string     `json:"language"`
	LastLoginAt    *time.Time `json:"lastLoginAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	Roles          []string   `json:"roles"`
	Permissions    []string   `json:"permissions"`
}

func (u *User) ToProfile() *UserProfile {
	roles := make([]string, 0, len(u.Roles))
	perms := make([]string, 0)
	seen := map[string]bool{}
	for _, r := range u.Roles {
		roles = append(roles, r.Name)
		for _, p := range r.Permissions {
			if !seen[p] {
				seen[p] = true
				perms = append(perms, p)
			}
		}
	}
	return &UserProfile{
		ID:             u.ID,
		OrganizationID: u.OrganizationID,
		Email:          u.Email,
		EmailVerified:  u.EmailVerified,
		Username:       u.Username,
		FirstName:      u.FirstName,
		LastName:       u.LastName,
		Status:         u.Status,
		MFAEnabled:     u.MFAEnabled,
		MFAType:        u.MFAType,
		PasskeyEnabled: u.PasskeyEnabled,
		Timezone:       u.Timezone,
		Language:       u.Language,
		LastLoginAt:    u.LastLoginAt,
		CreatedAt:      u.CreatedAt,
		Roles:          roles,
		Permissions:    perms,
	}
}

func (u *User) IsLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}

func (u *User) HasPermission(perm string) bool {
	for _, r := range u.Roles {
		for _, p := range r.Permissions {
			if p == "super:*" || p == perm {
				return true
			}
		}
	}
	return false
}
