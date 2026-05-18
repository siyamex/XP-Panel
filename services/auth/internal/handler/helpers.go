package handler

import (
	"github.com/google/uuid"
	"github.com/xp-panel/xp-panel/services/auth/internal/domain"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

// getUserFromClaims creates a minimal domain.User from JWT claims.
// For operations that need the full user, fetch from DB instead.
func getUserFromClaims(claims *service.Claims) (*domain.User, error) {
	return &domain.User{
		ID:             claims.UserID,
		OrganizationID: claims.OrgID,
		Email:          claims.Email,
		Username:       claims.Username,
	}, nil
}

func uuidFromString(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
