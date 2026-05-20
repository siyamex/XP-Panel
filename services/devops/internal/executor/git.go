package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	git "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// CloneOrPull clones the repo into workDir/<runID> and checks out the given branch.
// Returns (repoPath, commitSHA, error).
func CloneOrPull(ctx context.Context, repoURL, branch, workRoot, runID string) (string, string, error) {
	repoPath := filepath.Join(workRoot, runID)
	if err := os.MkdirAll(repoPath, 0750); err != nil {
		return "", "", fmt.Errorf("mkdir workspace: %w", err)
	}

	var repo *git.Repository
	var err error

	// Check if already cloned (resume on retry)
	if _, statErr := os.Stat(filepath.Join(repoPath, ".git")); statErr == nil {
		repo, err = git.PlainOpen(repoPath)
		if err == nil {
			wt, _ := repo.Worktree()
			_ = wt.Pull(&git.PullOptions{
				RemoteName:    "origin",
				ReferenceName: plumbing.NewBranchReferenceName(branch),
				Force:         true,
			})
		}
	}

	if repo == nil {
		repo, err = git.PlainCloneContext(ctx, repoPath, false, &git.CloneOptions{
			URL:           repoURL,
			ReferenceName: plumbing.NewBranchReferenceName(branch),
			SingleBranch:  true,
			Depth:         1,
		})
		if err != nil {
			return "", "", fmt.Errorf("git clone %s@%s: %w", repoURL, branch, err)
		}
	}

	head, err := repo.Head()
	if err != nil {
		return repoPath, "unknown", nil
	}
	return repoPath, head.Hash().String(), nil
}

// Cleanup removes the workspace directory after the run.
func Cleanup(workRoot, runID string) {
	_ = os.RemoveAll(filepath.Join(workRoot, runID))
}
