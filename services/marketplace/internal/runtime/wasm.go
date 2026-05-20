package runtime

import (
	"context"
	"fmt"
	"os"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

// PluginResult is returned after a WASM plugin execution.
type PluginResult struct {
	Output   string
	ExitCode uint32
}

// WASMRuntime executes WASM plugins using wazero (no CGO required).
type WASMRuntime struct {
	cache wazero.CompilationCache
}

// New creates a WASMRuntime with a shared compilation cache.
func New() (*WASMRuntime, error) {
	cache, err := wazero.NewCompilationCacheWithDir(os.TempDir())
	if err != nil {
		return nil, fmt.Errorf("wazero cache: %w", err)
	}
	return &WASMRuntime{cache: cache}, nil
}

// Close releases the compilation cache.
func (r *WASMRuntime) Close() { r.cache.Close(context.Background()) } //nolint:errcheck

// Execute runs a WASM binary (WASI-compatible) with the given args and env vars.
// stdout/stderr are captured and returned in PluginResult.Output.
// The plugin receives config as JSON via the first argument.
func (r *WASMRuntime) Execute(ctx context.Context, wasmBytes []byte, args []string, envVars map[string]string) (*PluginResult, error) {
	rt := wazero.NewRuntimeWithConfig(ctx, wazero.NewRuntimeConfig().WithCompilationCache(r.cache))
	defer rt.Close(ctx)

	// Instantiate WASI
	wasi_snapshot_preview1.MustInstantiate(ctx, rt)

	// Build env slice
	env := make([]string, 0, len(envVars))
	for k, v := range envVars {
		env = append(env, k+"="+v)
	}

	// Capture stdout/stderr
	outBuf := newBuffer()
	errBuf := newBuffer()

	modCfg := wazero.NewModuleConfig().
		WithStdout(outBuf).
		WithStderr(errBuf).
		WithArgs(append([]string{"plugin"}, args...)...).
		WithSysNanotime().
		WithSysWalltime().
		WithSysNanosleep()

	for _, e := range env {
		// wazero expects individual WithEnv calls
		if len(e) > 0 {
			for k, v := range envVars {
				modCfg = modCfg.WithEnv(k, v)
			}
			break
		}
	}

	// Compile and instantiate
	compiled, err := rt.CompileModule(ctx, wasmBytes)
	if err != nil {
		return nil, fmt.Errorf("compile wasm: %w", err)
	}
	defer compiled.Close(ctx)

	mod, err := rt.InstantiateModule(ctx, compiled, modCfg)
	if err != nil {
		// WASI exit codes are returned as errors
		if exitErr, ok := err.(*api.ExitError); ok {
			return &PluginResult{
				Output:   outBuf.String() + errBuf.String(),
				ExitCode: exitErr.ExitCode(),
			}, nil
		}
		return nil, fmt.Errorf("instantiate wasm: %w", err)
	}
	defer mod.Close(ctx)

	return &PluginResult{
		Output:   outBuf.String() + errBuf.String(),
		ExitCode: 0,
	}, nil
}

// ExecuteFile loads a .wasm file from disk and runs it.
func (r *WASMRuntime) ExecuteFile(ctx context.Context, wasmPath string, args []string, env map[string]string) (*PluginResult, error) {
	data, err := os.ReadFile(wasmPath)
	if err != nil {
		return nil, fmt.Errorf("read wasm file: %w", err)
	}
	return r.Execute(ctx, data, args, env)
}
