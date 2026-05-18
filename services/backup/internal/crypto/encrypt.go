package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
)

// EncryptStream wraps a writer with AES-256-GCM streaming encryption.
// Returns the writer and the generated nonce (prepended to ciphertext).
func NewEncryptingWriter(key []byte, dst io.Writer) (io.WriteCloser, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	if _, err := dst.Write(nonce); err != nil {
		return nil, err
	}

	return &gcmWriter{gcm: gcm, nonce: nonce, dst: dst, buf: make([]byte, 0, 64*1024)}, nil
}

type gcmWriter struct {
	gcm   cipher.AEAD
	nonce []byte
	dst   io.Writer
	buf   []byte
}

func (w *gcmWriter) Write(p []byte) (int, error) {
	w.buf = append(w.buf, p...)
	// Flush in 64KB chunks
	for len(w.buf) >= 64*1024 {
		if err := w.flush(64 * 1024); err != nil {
			return 0, err
		}
	}
	return len(p), nil
}

func (w *gcmWriter) flush(n int) error {
	chunk := w.buf[:n]
	sealed := w.gcm.Seal(nil, w.nonce, chunk, nil)
	_, err := w.dst.Write(sealed)
	w.buf = w.buf[n:]
	return err
}

func (w *gcmWriter) Close() error {
	if len(w.buf) > 0 {
		return w.flush(len(w.buf))
	}
	return nil
}

// GenerateKey generates a random 32-byte AES-256 key.
func GenerateKey() ([]byte, error) {
	key := make([]byte, 32)
	_, err := rand.Read(key)
	return key, err
}
