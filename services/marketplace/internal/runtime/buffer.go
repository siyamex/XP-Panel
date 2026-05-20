package runtime

import (
	"bytes"
	"sync"
)

// buffer is a thread-safe bytes.Buffer for capturing WASM output.
type buffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func newBuffer() *buffer { return &buffer{} }

func (b *buffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *buffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
