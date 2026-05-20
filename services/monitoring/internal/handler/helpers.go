package handler

import (
	"crypto/rand"
	"encoding/hex"
)

func generateAPIKey() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "xpm_" + hex.EncodeToString(b)
}
