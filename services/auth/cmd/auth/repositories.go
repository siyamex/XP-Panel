package main

// Repository constructors — wire concrete implementations here.
// Actual implementations live in internal/repository/.
// This file keeps main.go clean.

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

// ── User Repository ───────────────────────────────────────────────────────────

type pgUserRepo struct{ db *pgxpool.Pool }

func newUserRepo(db *pgxpool.Pool) service.UserRepository { return &pgUserRepo{db: db} }

func (r *pgUserRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, organization_id, email, email_verified, username, password_hash,
		        first_name, last_name, status, failed_login_count, locked_until,
		        last_login_at, mfa_enabled, mfa_type, mfa_secret, passkey_enabled,
		        timezone, language, created_at, updated_at
		 FROM users WHERE email = $1`, email,
	).Scan(
		&u.ID, &u.OrganizationID, &u.Email, &u.EmailVerified, &u.Username, &u.PasswordHash,
		&u.FirstName, &u.LastName, &u.Status, &u.FailedLoginCount, &u.LockedUntil,
		&u.LastLoginAt, &u.MFAEnabled, &u.MFAType, &u.MFASecret, &u.PasskeyEnabled,
		&u.Timezone, &u.Language, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *pgUserRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRow(ctx,
		`SELECT id, organization_id, email, email_verified, username, password_hash,
		        first_name, last_name, status, failed_login_count, locked_until,
		        last_login_at, mfa_enabled, mfa_type, mfa_secret, passkey_enabled,
		        timezone, language, created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(
		&u.ID, &u.OrganizationID, &u.Email, &u.EmailVerified, &u.Username, &u.PasswordHash,
		&u.FirstName, &u.LastName, &u.Status, &u.FailedLoginCount, &u.LockedUntil,
		&u.LastLoginAt, &u.MFAEnabled, &u.MFAType, &u.MFASecret, &u.PasskeyEnabled,
		&u.Timezone, &u.Language, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *pgUserRepo) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	u := &domain.User{}
	err := r.db.QueryRow(ctx, `SELECT id FROM users WHERE username = $1`, username).Scan(&u.ID)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *pgUserRepo) Create(ctx context.Context, u *domain.User, passwordHash string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO users (id, organization_id, email, email_verified, username, password_hash,
		                    status, timezone, language)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		u.ID, u.OrganizationID, u.Email, u.EmailVerified, u.Username, passwordHash,
		u.Status, u.Timezone, u.Language,
	)
	return err
}

func (r *pgUserRepo) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2`, hash, id)
	return err
}

func (r *pgUserRepo) IncrementFailedLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id=$1`, id)
	return err
}

func (r *pgUserRepo) LockAccount(ctx context.Context, id uuid.UUID, until time.Time) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET status='locked', locked_until=$1 WHERE id=$2`, until, id)
	return err
}

func (r *pgUserRepo) ResetFailedLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET failed_login_count=0, locked_until=NULL, status='active' WHERE id=$1`, id)
	return err
}

func (r *pgUserRepo) UpdateLastLogin(ctx context.Context, id uuid.UUID, ip string) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET last_login_at=NOW() WHERE id=$1`, id)
	return err
}

func (r *pgUserRepo) GetRoles(ctx context.Context, userID uuid.UUID) ([]domain.Role, error) {
	rows, err := r.db.Query(ctx,
		`SELECT r.id, r.organization_id, r.name, r.is_system, r.permissions
		 FROM roles r
		 JOIN user_roles ur ON ur.role_id = r.id
		 WHERE ur.user_id = $1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var role domain.Role
		var permsJSON []byte
		if err := rows.Scan(&role.ID, &role.OrganizationID, &role.Name, &role.IsSystem, &permsJSON); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, nil
}

// ── Org Repository ────────────────────────────────────────────────────────────

type pgOrgRepo struct{ db *pgxpool.Pool }

func newOrgRepo(db *pgxpool.Pool) service.OrgRepository { return &pgOrgRepo{db: db} }

func (r *pgOrgRepo) FindBySlug(ctx context.Context, slug string) (*domain.Organization, error) {
	org := &domain.Organization{}
	err := r.db.QueryRow(ctx, `SELECT id, name, slug FROM organizations WHERE slug=$1`, slug).
		Scan(&org.ID, &org.Name, &org.Slug)
	return org, err
}

func (r *pgOrgRepo) Create(ctx context.Context, org *domain.Organization) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO organizations (id, name, slug, status) VALUES ($1,$2,$3,$4)`,
		org.ID, org.Name, org.Slug, "active",
	)
	return err
}

func (r *pgOrgRepo) SetOwner(ctx context.Context, orgID, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE organizations SET owner_id=$1 WHERE id=$2`, userID, orgID)
	return err
}

// ── Session Repository ────────────────────────────────────────────────────────

type pgSessionRepo struct {
	db  *pgxpool.Pool
	rdb *redis.Client
}

func newSessionRepo(db *pgxpool.Pool, rdb *redis.Client) service.SessionRepository {
	return &pgSessionRepo{db: db, rdb: rdb}
}

func (r *pgSessionRepo) Create(ctx context.Context, s *domain.Session) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO user_sessions (id, user_id, token_hash, refresh_token_hash, ip_address, user_agent, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.UserID, s.TokenHash, s.RefreshTokenHash, s.IPAddress, s.UserAgent, s.ExpiresAt,
	)
	return err
}

func (r *pgSessionRepo) FindByRefreshTokenHash(ctx context.Context, hash string) (*domain.Session, error) {
	s := &domain.Session{}
	err := r.db.QueryRow(ctx,
		`SELECT id, user_id, token_hash, refresh_token_hash, expires_at FROM user_sessions
		 WHERE refresh_token_hash=$1`, hash,
	).Scan(&s.ID, &s.UserID, &s.TokenHash, &s.RefreshTokenHash, &s.ExpiresAt)
	return s, err
}

func (r *pgSessionRepo) DeleteByID(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM user_sessions WHERE id=$1`, id)
	return err
}

func (r *pgSessionRepo) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM user_sessions WHERE user_id=$1`, userID)
	return err
}

// ── MFA Repository ────────────────────────────────────────────────────────────

type pgMFARepo struct{ db *pgxpool.Pool }

func newMFARepo(db *pgxpool.Pool) service.MFARepository { return &pgMFARepo{db: db} }

func (r *pgMFARepo) SetMFASecret(ctx context.Context, userID uuid.UUID, secret string, mfaType domain.MFAType) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET mfa_secret=$1, mfa_type=$2, updated_at=NOW() WHERE id=$3`, secret, mfaType, userID)
	return err
}

func (r *pgMFARepo) EnableMFA(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET mfa_enabled=true, updated_at=NOW() WHERE id=$1`, userID)
	return err
}

func (r *pgMFARepo) DisableMFA(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET mfa_enabled=false, mfa_secret=NULL, mfa_type=NULL, updated_at=NOW() WHERE id=$1`, userID)
	return err
}

func (r *pgMFARepo) GetMFASecret(ctx context.Context, userID uuid.UUID) (string, error) {
	var secret string
	err := r.db.QueryRow(ctx, `SELECT mfa_secret FROM users WHERE id=$1 AND mfa_secret IS NOT NULL`, userID).Scan(&secret)
	return secret, err
}
