package crypto

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
)

type DKIMKeyPair struct {
	PrivateKeyPEM string
	PublicKeyPEM  string
	DNSTxtValue   string // v=DKIM1; k=rsa; p=<base64>
}

// GenerateRSAKeyPair creates a new RSA key pair for DKIM signing.
func GenerateRSAKeyPair(keySize int) (*DKIMKeyPair, error) {
	if keySize < 1024 {
		keySize = 2048
	}

	privateKey, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		return nil, fmt.Errorf("generate rsa key: %w", err)
	}

	// Encode private key as PKCS8 PEM
	privDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}
	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privDER,
	})

	// Encode public key as PKIX PEM
	pubDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("marshal public key: %w", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubDER,
	})

	// Build DNS TXT record value: v=DKIM1; k=rsa; p=<base64-encoded-DER>
	pubBase64 := base64.StdEncoding.EncodeToString(pubDER)
	dnsTxt := fmt.Sprintf("v=DKIM1; k=rsa; p=%s", pubBase64)

	return &DKIMKeyPair{
		PrivateKeyPEM: string(privPEM),
		PublicKeyPEM:  string(pubPEM),
		DNSTxtValue:   dnsTxt,
	}, nil
}

// DNSRecordName returns the DNS name for the DKIM TXT record.
// e.g. "default._domainkey.example.com"
func DNSRecordName(selector, domain string) string {
	return fmt.Sprintf("%s._domainkey.%s", selector, domain)
}
