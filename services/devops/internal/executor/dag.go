package executor

import (
	"fmt"

	"github.com/xpanel/devops/internal/domain"
)

// TopoSort returns steps in dependency order.
// Each step may declare DependsOn []string (step names it waits for).
// Steps with no declared deps are ordered by their index (stable).
func TopoSort(steps []domain.PipelineStep) ([]domain.PipelineStep, error) {
	if len(steps) == 0 {
		return nil, nil
	}

	// If no step has DependsOn, return as-is (sequential by definition order)
	hasDeps := false
	for _, s := range steps {
		if len(s.DependsOn) > 0 {
			hasDeps = true
			break
		}
	}
	if !hasDeps {
		return steps, nil
	}

	nameToIdx := make(map[string]int, len(steps))
	for i, s := range steps {
		if _, exists := nameToIdx[s.Name]; exists {
			return nil, fmt.Errorf("duplicate step name: %q", s.Name)
		}
		nameToIdx[s.Name] = i
	}

	// Build adjacency + in-degree
	inDegree := make([]int, len(steps))
	adj := make([][]int, len(steps))
	for i, s := range steps {
		for _, dep := range s.DependsOn {
			j, ok := nameToIdx[dep]
			if !ok {
				return nil, fmt.Errorf("step %q depends on unknown step %q", s.Name, dep)
			}
			adj[j] = append(adj[j], i)
			inDegree[i]++
		}
	}

	// Kahn's algorithm
	queue := []int{}
	for i, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, i)
		}
	}

	sorted := make([]domain.PipelineStep, 0, len(steps))
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		sorted = append(sorted, steps[node])
		for _, neighbor := range adj[node] {
			inDegree[neighbor]--
			if inDegree[neighbor] == 0 {
				queue = append(queue, neighbor)
			}
		}
	}

	if len(sorted) != len(steps) {
		return nil, fmt.Errorf("pipeline has a dependency cycle")
	}
	return sorted, nil
}
