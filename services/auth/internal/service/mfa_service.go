package service

import (
	"context"
	"encoding/base32"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
)

var (
	ErrInvalidMFACode  = errors.New("invalid MFA code")
	ErrMFANotEnabled   = errors.New("MFA is not enabled")
	ErrMFAAlreadySetup = errors.New("MFA is already configured")
)

type MFARepository interface {
	SetMFASecret(ctx context.Context, userID uuid.UUID, secret string, mfaType domain.MFAType) error
	EnableMFA(ctx context.Context, userID uuid.UUID) error
	DisableMFA(ctx context.Context, userID uuid.UUID) error
	GetMFASecret(ctx context.Context, userID uuid.UUID) (string, error)
}

type MFAService struct {
	repo   MFARepository
	issuer string
}

func NewMFAService(repo MFARepository, issuer string) *MFAService {
	return &MFAService{repo: repo, issuer: issuer}
}

type TOTPSetupResult struct {
	Secret     string `json:"secret"`
	QRCodeURL  string `json:"qrCodeUrl"`
	BackupCode string `json:"backupCode"`
}

func (s *MFAService) GenerateTOTPSetup(ctx context.Context, user *domain.User) (*TOTPSetupResult, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      s.issuer,
		AccountName: user.Email,
		SecretSize:  20,
	})
	if err != nil {
		return nil, err
	}

	// Store encrypted secret (in production, encrypt before storage)
	if err := s.repo.SetMFASecret(ctx, user.ID, key.Secret(), domain.MFATypeTOTP); err != nil {
		return nil, err
	}

	return &TOTPSetupResult{
		Secret:    key.Secret(),
		QRCodeURL: key.URL(),
	}, nil
}

func (s *MFAService) VerifyTOTP(ctx context.Context, userID uuid.UUID, code string) error {
	secret, err := s.repo.GetMFASecret(ctx, userID)
	if err != nil {
		return ErrMFANotEnabled
	}

	// Normalize secret
	secret = strings.ToUpper(strings.ReplaceAll(secret, " ", ""))
	if _, err := base32.StdEncoding.DecodeString(secret); err != nil {
		secret = base32.StdEncoding.EncodeToString([]byte(secret))
	}

	if !totp.Validate(code, secret) {
		return ErrInvalidMFACode
	}
	return nil
}

func (s *MFAService) ConfirmTOTPSetup(ctx context.Context, userID uuid.UUID, code string) error {
	if err := s.VerifyTOTP(ctx, userID, code); err != nil {
		return err
	}
	return s.repo.EnableMFA(ctx, userID)
}

func (s *MFAService) DisableMFA(ctx context.Context, userID uuid.UUID, code string) error {
	if err := s.VerifyTOTP(ctx, userID, code); err != nil {
		return err
	}
	return s.repo.DisableMFA(ctx, userID)
}
