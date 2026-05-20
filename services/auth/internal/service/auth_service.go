package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
	"golang.org/x/crypto/argon2"
)

const (
	maxFailedAttempts = 5
	lockDuration      = 15 * time.Minute
	argonMemory       = 65536
	argonIterations   = 3
	argonParallelism  = 4
	argonKeyLen       = 32
	argonSaltLen      = 16
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountSuspended   = errors.New("account is suspended")
	ErrAccountLocked      = errors.New("account is temporarily locked")
	ErrAccountPending     = errors.New("account is pending email verification")
	ErrMFARequired        = errors.New("MFA verification required")
	ErrUserExists   = errors.New("user with this email or username already exists")
	ErrOrgSlugTaken = errors.New("organization slug is already taken")
)

type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User, passwordHash string) error
	UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error
	IncrementFailedLogin(ctx context.Context, id uuid.UUID) error
	LockAccount(ctx context.Context, id uuid.UUID, until time.Time) error
	ResetFailedLogin(ctx context.Context, id uuid.UUID) error
	UpdateLastLogin(ctx context.Context, id uuid.UUID, ip string) error
	GetRoles(ctx context.Context, userID uuid.UUID) ([]domain.Role, error)
	CreateRoleAndAssign(ctx context.Context, orgID, userID uuid.UUID, role domain.Role) error
}

type OrgRepository interface {
	FindBySlug(ctx context.Context, slug string) (*domain.Organization, error)
	Create(ctx context.Context, org *domain.Organization) error
	SetOwner(ctx context.Context, orgID, userID uuid.UUID) error
}

type SessionRepository interface {
	Create(ctx context.Context, session *domain.Session) error
	FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error)
	DeleteByID(ctx context.Context, id uuid.UUID) error
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
}

type AuthService struct {
	users    UserRepository
	orgs     OrgRepository
	sessions SessionRepository
	jwt      *JWTService
	mfa      *MFAService
}

func NewAuthService(
	users UserRepository,
	orgs OrgRepository,
	sessions SessionRepository,
	jwt *JWTService,
	mfa *MFAService,
) *AuthService {
	return &AuthService{users: users, orgs: orgs, sessions: sessions, jwt: jwt, mfa: mfa}
}

type RegisterInput struct {
	OrgName  string
	OrgSlug  string
	Email    string
	Username string
	Password string
}

func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*domain.TokenPair, error) {
	// Check org slug uniqueness
	if _, err := s.orgs.FindBySlug(ctx, in.OrgSlug); err == nil {
		return nil, ErrOrgSlugTaken
	}

	// Check user uniqueness
	if u, _ := s.users.FindByEmail(ctx, in.Email); u != nil {
		return nil, ErrUserExists
	}
	if u, _ := s.users.FindByUsername(ctx, in.Username); u != nil {
		return nil, ErrUserExists
	}

	// Create organization
	org := &domain.Organization{
		ID:     uuid.New(),
		Name:   in.OrgName,
		Slug:   in.OrgSlug,
		Status: "active",
	}
	if err := s.orgs.Create(ctx, org); err != nil {
		return nil, err
	}

	// Hash password
	hash, err := hashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	// Create user
	user := &domain.User{
		ID:             uuid.New(),
		OrganizationID: org.ID,
		Email:          strings.ToLower(in.Email),
		EmailVerified:  false,
		Username:       in.Username,
		Status:         domain.UserStatusPending,
		Timezone:       "UTC",
		Language:       "en",
	}
	if err := s.users.Create(ctx, user, hash); err != nil {
		return nil, err
	}

	// Create admin role in DB and assign to user
	adminRole := domain.Role{
		ID:             uuid.New(),
		OrganizationID: &org.ID,
		Name:           "admin",
		IsSystem:       true,
		Permissions:    adminPermissions(),
	}
	if err := s.users.CreateRoleAndAssign(ctx, org.ID, user.ID, adminRole); err != nil {
		return nil, err
	}
	user.Roles = []domain.Role{adminRole}

	// Link org owner
	_ = s.orgs.SetOwner(ctx, org.ID, user.ID)

	// Issue tokens (MFA not required for fresh registration)
	sessionID := uuid.New()
	pair, refreshToken, err := s.jwt.IssueTokenPair(user, sessionID, true)
	if err != nil {
		return nil, err
	}

	session := &domain.Session{
		ID:               sessionID,
		UserID:           user.ID,
		TokenHash:        hashToken(pair.AccessToken),
		RefreshTokenHash: ptr(hashToken(refreshToken)),
		ExpiresAt:        pair.ExpiresAt,
	}
	_ = s.sessions.Create(ctx, session)

	return pair, nil
}

type LoginInput struct {
	Email    string
	Password string
	IP       string
	UA       string
}

type LoginResult struct {
	Tokens     *domain.TokenPair
	MFARequired bool
	TempToken  string // short-lived token to proceed to MFA step
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (*LoginResult, error) {
	user, err := s.users.FindByEmail(ctx, strings.ToLower(in.Email))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	switch user.Status {
	case domain.UserStatusSuspended:
		return nil, ErrAccountSuspended
	case domain.UserStatusLocked:
		if user.IsLocked() {
			return nil, ErrAccountLocked
		}
	}

	if user.PasswordHash == nil || !checkPassword(in.Password, *user.PasswordHash) {
		_ = s.users.IncrementFailedLogin(ctx, user.ID)
		if user.FailedLoginCount+1 >= maxFailedAttempts {
			lockUntil := time.Now().Add(lockDuration)
			_ = s.users.LockAccount(ctx, user.ID, lockUntil)
		}
		return nil, ErrInvalidCredentials
	}

	_ = s.users.ResetFailedLogin(ctx, user.ID)
	_ = s.users.UpdateLastLogin(ctx, user.ID, in.IP)

	roles, _ := s.users.GetRoles(ctx, user.ID)
	user.Roles = roles

	if user.MFAEnabled {
		// Issue a short-lived temp token for MFA step
		sessionID := uuid.New()
		tempPair, _, _ := s.jwt.IssueTokenPair(user, sessionID, false)
		return &LoginResult{MFARequired: true, TempToken: tempPair.AccessToken}, nil
	}

	sessionID := uuid.New()
	pair, refreshToken, err := s.jwt.IssueTokenPair(user, sessionID, true)
	if err != nil {
		return nil, err
	}

	session := &domain.Session{
		ID:               sessionID,
		UserID:           user.ID,
		TokenHash:        hashToken(pair.AccessToken),
		RefreshTokenHash: ptr(hashToken(refreshToken)),
		IPAddress:        &in.IP,
		UserAgent:        &in.UA,
		ExpiresAt:        pair.ExpiresAt,
	}
	_ = s.sessions.Create(ctx, session)

	return &LoginResult{Tokens: pair}, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	hash := hashToken(refreshToken)
	session, err := s.sessions.FindByRefreshTokenHash(ctx, hash)
	if err != nil || session.ExpiresAt.Before(time.Now()) {
		return nil, ErrInvalidToken
	}

	user, err := s.users.FindByID(ctx, session.UserID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	roles, _ := s.users.GetRoles(ctx, user.ID)
	user.Roles = roles

	// Rotate session
	_ = s.sessions.DeleteByID(ctx, session.ID)

	newSessionID := uuid.New()
	pair, newRefresh, err := s.jwt.IssueTokenPair(user, newSessionID, true)
	if err != nil {
		return nil, err
	}

	newSession := &domain.Session{
		ID:               newSessionID,
		UserID:           user.ID,
		TokenHash:        hashToken(pair.AccessToken),
		RefreshTokenHash: ptr(hashToken(newRefresh)),
		ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
	}
	_ = s.sessions.Create(ctx, newSession)

	return pair, nil
}

func (s *AuthService) Logout(ctx context.Context, sessionID uuid.UUID) error {
	return s.sessions.DeleteByID(ctx, sessionID)
}

type OAuthInput struct {
	Provider string
	Email    string
	Name     string
	IP       string
	UA       string
}

// OAuthLogin finds an existing user by email or creates a new one (org = email domain).
func (s *AuthService) OAuthLogin(ctx context.Context, in OAuthInput) (*domain.TokenPair, error) {
	user, err := s.users.FindByEmail(ctx, strings.ToLower(in.Email))
	if err != nil {
		// Auto-register: derive org slug from email domain
		parts := strings.SplitN(in.Email, "@", 2)
		slug := strings.ReplaceAll(parts[len(parts)-1], ".", "-")
		slug = slug + "-" + uuid.New().String()[:8]

		firstName := in.Name
		if idx := strings.Index(in.Name, " "); idx > 0 {
			firstName = in.Name[:idx]
		}
		username := strings.ToLower(strings.ReplaceAll(firstName, " ", "")) + "-" + uuid.New().String()[:6]

		_, err2 := s.Register(ctx, RegisterInput{
			OrgName:  in.Name + "'s Organization",
			OrgSlug:  slug,
			Email:    in.Email,
			Username: username,
			Password: uuid.New().String(), // random unusable password
		})
		if err2 != nil {
			return nil, err2
		}
		user, err = s.users.FindByEmail(ctx, strings.ToLower(in.Email))
		if err != nil {
			return nil, err
		}
	}

	// Mark user active (OAuth = verified email)
	if user.Status == domain.UserStatusPending {
		_ = s.users.ResetFailedLogin(ctx, user.ID)
	}
	_ = s.users.UpdateLastLogin(ctx, user.ID, in.IP)

	roles, _ := s.users.GetRoles(ctx, user.ID)
	user.Roles = roles

	sessionID := uuid.New()
	pair, refreshToken, err := s.jwt.IssueTokenPair(user, sessionID, true)
	if err != nil {
		return nil, err
	}
	session := &domain.Session{
		ID:               sessionID,
		UserID:           user.ID,
		TokenHash:        hashToken(pair.AccessToken),
		RefreshTokenHash: ptr(hashToken(refreshToken)),
		IPAddress:        &in.IP,
		UserAgent:        &in.UA,
		ExpiresAt:        pair.ExpiresAt,
	}
	_ = s.sessions.Create(ctx, session)
	return pair, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func hashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := uuid.New().MarshalBinary(); err != nil {
		return "", err
	}
	copy(salt, uuid.New().String())
	hash := argon2.IDKey([]byte(password), salt, argonIterations, argonMemory, argonParallelism, argonKeyLen)
	return hex.EncodeToString(salt) + "$" + hex.EncodeToString(hash), nil
}

func checkPassword(password, hash string) bool {
	parts := strings.SplitN(hash, "$", 2)
	if len(parts) != 2 {
		return false
	}
	salt, _ := hex.DecodeString(parts[0])
	expected, _ := hex.DecodeString(parts[1])
	actual := argon2.IDKey([]byte(password), salt, argonIterations, argonMemory, argonParallelism, argonKeyLen)
	if len(actual) != len(expected) {
		return false
	}
	diff := byte(0)
	for i := range actual {
		diff |= actual[i] ^ expected[i]
	}
	return diff == 0
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func ptr[T any](v T) *T { return &v }

func adminPermissions() []string {
	return []string{
		"domains:read", "domains:write", "domains:delete",
		"dns:read", "dns:write",
		"mail:read", "mail:write",
		"files:read", "files:write",
		"db:read", "db:write",
		"backup:read", "backup:write", "backup:restore",
		"security:read", "security:write",
		"monitoring:read", "monitoring:write",
		"billing:read", "billing:write",
		"devops:read", "devops:write",
		"docker:read", "docker:write",
		"ai:use",
		"marketplace:read", "marketplace:install",
		"admin:users", "admin:servers",
	}
}
