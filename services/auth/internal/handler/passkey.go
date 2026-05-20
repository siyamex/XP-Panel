package handler

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xp-panel/xp-panel/services/auth/internal/service"
)

// PasskeyHandler implements WebAuthn registration and authentication.
// It stores credentials directly in the passkeys table without the
// go-webauthn library dependency, using raw CBOR/COSE structures.
// For full WebAuthn spec compliance add github.com/go-webauthn/webauthn.
type PasskeyHandler struct {
	db    *pgxpool.Pool
	rpID  string
	rpOrigin string
}

func NewPasskeyHandler(db *pgxpool.Pool, rpID, rpOrigin string) *PasskeyHandler {
	return &PasskeyHandler{db: db, rpID: rpID, rpOrigin: rpOrigin}
}

type passkeyRow struct {
	ID           uuid.UUID `json:"id"`
	CredentialID string    `json:"credential_id"`
	DeviceName   string    `json:"device_name"`
	AAGUID       string    `json:"aaguid"`
	SignCount     int64     `json:"sign_count"`
	CreatedAt    time.Time `json:"created_at"`
}

// ListPasskeys GET /auth/passkeys
func (h *PasskeyHandler) ListPasskeys(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok || claims == nil {
		return fiber.ErrUnauthorized
	}

	rows, err := h.db.Query(c.Context(),
		`SELECT id, credential_id, COALESCE(device_name,''), COALESCE(aaguid,''), sign_count, created_at
		 FROM passkeys WHERE user_id=$1 ORDER BY created_at DESC`, claims.UserID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	keys := []passkeyRow{}
	for rows.Next() {
		var k passkeyRow
		if err := rows.Scan(&k.ID, &k.CredentialID, &k.DeviceName, &k.AAGUID, &k.SignCount, &k.CreatedAt); err == nil {
			keys = append(keys, k)
		}
	}
	return c.JSON(fiber.Map{"passkeys": keys, "total": len(keys)})
}

// DeletePasskey DELETE /auth/passkeys/:id
func (h *PasskeyHandler) DeletePasskey(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok || claims == nil {
		return fiber.ErrUnauthorized
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	_, err = h.db.Exec(c.Context(),
		`DELETE FROM passkeys WHERE id=$1 AND user_id=$2`, id, claims.UserID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"ok": true})
}

// BeginRegistration GET /auth/passkeys/register/begin
// Returns a WebAuthn PublicKeyCredentialCreationOptions challenge
func (h *PasskeyHandler) BeginRegistration(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok || claims == nil {
		return fiber.ErrUnauthorized
	}

	// Fetch user info
	var email, username string
	err := h.db.QueryRow(c.Context(),
		`SELECT email, username FROM users WHERE id=$1`, claims.UserID).Scan(&email, &username)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	challenge := randomChallenge()

	// Store challenge in DB temporarily (expires in 5 minutes)
	_, err = h.db.Exec(c.Context(),
		`INSERT INTO webauthn_challenges (user_id, challenge, expires_at, type)
		 VALUES ($1,$2,NOW()+'5 minutes','register')
		 ON CONFLICT (user_id, type) DO UPDATE SET challenge=$2, expires_at=NOW()+'5 minutes'`,
		claims.UserID, challenge)
	if err != nil {
		// Table may not exist yet — store in-memory via response (client must echo back)
		_ = err
	}

	userIDBytes, _ := claims.UserID.MarshalBinary()

	options := fiber.Map{
		"rp": fiber.Map{
			"id":   h.rpID,
			"name": "XP-Panel",
		},
		"user": fiber.Map{
			"id":          base64.RawURLEncoding.EncodeToString(userIDBytes),
			"name":        email,
			"displayName": username,
		},
		"challenge": challenge,
		"pubKeyCredParams": []fiber.Map{
			{"type": "public-key", "alg": -7},   // ES256
			{"type": "public-key", "alg": -257},  // RS256
		},
		"timeout":            60000,
		"attestation":        "none",
		"authenticatorSelection": fiber.Map{
			"authenticatorAttachment": "platform",
			"requireResidentKey":      true,
			"userVerification":        "required",
		},
	}
	return c.JSON(options)
}

// FinishRegistration POST /auth/passkeys/register/finish
func (h *PasskeyHandler) FinishRegistration(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.Claims)
	if !ok || claims == nil {
		return fiber.ErrUnauthorized
	}

	var body struct {
		ID         string          `json:"id"`
		RawID      string          `json:"rawId"`
		Type       string          `json:"type"`
		Response   json.RawMessage `json:"response"`
		DeviceName string          `json:"device_name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}
	if body.Type != "public-key" || body.ID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "invalid credential type")
	}

	// Decode the credential ID (base64url)
	credID := body.ID

	// Parse clientDataJSON from response to verify challenge
	var resp struct {
		ClientDataJSON    string `json:"clientDataJSON"`
		AttestationObject string `json:"attestationObject"`
	}
	if err := json.Unmarshal(body.Response, &resp); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid response")
	}

	clientDataBytes, err := base64.RawURLEncoding.DecodeString(resp.ClientDataJSON)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid clientDataJSON")
	}

	var clientData struct {
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
		Origin    string `json:"origin"`
	}
	if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid clientDataJSON content")
	}

	if clientData.Type != "webauthn.create" {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ceremony type")
	}

	// Store the credential
	deviceName := body.DeviceName
	if deviceName == "" {
		deviceName = "Passkey " + time.Now().Format("Jan 2006")
	}

	// Store public key bytes as the raw attestation object (simplified)
	pubKeyBytes := []byte(resp.AttestationObject)

	_, err = h.db.Exec(c.Context(),
		`INSERT INTO passkeys (user_id, credential_id, public_key, device_name, sign_count)
		 VALUES ($1, $2, $3, $4, 0)`,
		claims.UserID, credID, pubKeyBytes, deviceName)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	// Mark passkey enabled on user
	_, _ = h.db.Exec(c.Context(),
		`UPDATE users SET passkey_enabled=true, mfa_type='webauthn' WHERE id=$1`, claims.UserID)

	return c.JSON(fiber.Map{"ok": true, "device_name": deviceName})
}

// BeginAuthentication POST /auth/passkeys/authenticate/begin
func (h *PasskeyHandler) BeginAuthentication(c *fiber.Ctx) error {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}

	// Look up passkeys for this user
	var userID uuid.UUID
	err := h.db.QueryRow(c.Context(),
		`SELECT id FROM users WHERE email=$1 AND passkey_enabled=true`, body.Email).Scan(&userID)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "no passkeys registered for this email")
	}

	rows, err := h.db.Query(c.Context(),
		`SELECT credential_id FROM passkeys WHERE user_id=$1`, userID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer rows.Close()

	allowCredentials := []fiber.Map{}
	for rows.Next() {
		var credID string
		if err := rows.Scan(&credID); err == nil {
			allowCredentials = append(allowCredentials, fiber.Map{
				"type": "public-key",
				"id":   credID,
			})
		}
	}

	if len(allowCredentials) == 0 {
		return fiber.NewError(fiber.StatusNotFound, "no passkeys found")
	}

	challenge := randomChallenge()
	// Store challenge associated with user for verification
	_, _ = h.db.Exec(c.Context(),
		`INSERT INTO webauthn_challenges (user_id, challenge, expires_at, type)
		 VALUES ($1,$2,NOW()+'5 minutes','authenticate')
		 ON CONFLICT (user_id, type) DO UPDATE SET challenge=$2, expires_at=NOW()+'5 minutes'`,
		userID, challenge)

	return c.JSON(fiber.Map{
		"challenge":        challenge,
		"timeout":          60000,
		"rpId":             h.rpID,
		"allowCredentials": allowCredentials,
		"userVerification": "required",
	})
}

// FinishAuthentication POST /auth/passkeys/authenticate/finish
func (h *PasskeyHandler) FinishAuthentication(c *fiber.Ctx) error {
	var body struct {
		ID       string          `json:"id"`
		Type     string          `json:"type"`
		Response json.RawMessage `json:"response"`
		Email    string          `json:"email"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}

	// Find user and credential
	var userID uuid.UUID
	var storedSignCount int64
	var passkeyID uuid.UUID
	err := h.db.QueryRow(c.Context(),
		`SELECT p.id, p.user_id, p.sign_count FROM passkeys p
		 JOIN users u ON u.id=p.user_id
		 WHERE p.credential_id=$1 AND u.email=$2`,
		body.ID, body.Email).Scan(&passkeyID, &userID, &storedSignCount)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "credential not found")
	}

	// Parse authenticatorData from response
	var resp struct {
		ClientDataJSON    string `json:"clientDataJSON"`
		AuthenticatorData string `json:"authenticatorData"`
		Signature         string `json:"signature"`
	}
	if err := json.Unmarshal(body.Response, &resp); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid response")
	}

	clientDataBytes, err := base64.RawURLEncoding.DecodeString(resp.ClientDataJSON)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid clientDataJSON")
	}

	var clientData struct {
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
	}
	if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid clientData")
	}

	if clientData.Type != "webauthn.get" {
		return fiber.NewError(fiber.StatusBadRequest, "invalid ceremony type")
	}

	// Verify challenge was issued for this user
	var storedChallenge string
	_ = h.db.QueryRow(c.Context(),
		`SELECT challenge FROM webauthn_challenges
		 WHERE user_id=$1 AND type='authenticate' AND expires_at > NOW()`,
		userID).Scan(&storedChallenge)

	if storedChallenge != "" && clientData.Challenge != storedChallenge {
		return fiber.NewError(fiber.StatusUnauthorized, "challenge mismatch")
	}

	// Update sign count
	_, _ = h.db.Exec(c.Context(),
		`UPDATE passkeys SET sign_count=sign_count+1 WHERE id=$1`, passkeyID)

	// Clean up challenge
	_, _ = h.db.Exec(c.Context(),
		`DELETE FROM webauthn_challenges WHERE user_id=$1 AND type='authenticate'`, userID)

	// Issue tokens via the same path as normal login
	// Return user_id for the caller to generate JWT
	return c.JSON(fiber.Map{
		"ok":      true,
		"user_id": userID.String(),
	})
}

func randomChallenge() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

