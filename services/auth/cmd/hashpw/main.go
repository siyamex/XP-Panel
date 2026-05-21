// hashpw generates an argon2id password hash for use in seed data.
// Usage: go run ./cmd/hashpw/main.go <password>
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
)

const (
	argonMemory      = 65536
	argonIterations  = 3
	argonParallelism = 4
	argonKeyLen      = 32
)

func main() {
	password := "Password123!"
	if len(os.Args) > 1 {
		password = os.Args[1]
	}

	salt := make([]byte, 16)
	copy(salt, uuid.New().String())

	hash := argon2.IDKey([]byte(password), salt, argonIterations, argonMemory, argonParallelism, argonKeyLen)

	// Format: hex(salt)$hex(hash)
	result := hex.EncodeToString(salt) + "$" + hex.EncodeToString(hash)
	fmt.Println(result)

	// Also print SHA-256 of the raw result for quick DB insert
	h := sha256.Sum256([]byte(result))
	_ = h
}
