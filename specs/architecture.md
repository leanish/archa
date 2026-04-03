# Architecture

Archa answers questions about how your code behaves by selecting relevant repos, syncing them locally, and running Codex against the right workspace.

## High-level flow

1. CLI parses a command.
2. Config is loaded from the user config path.
3. Repo selection chooses explicit repos or heuristic candidates.
4. Repo sync clones or fast-forwards the selected repos.
5. Codex runs against either the single selected repo or the managed repos root.
6. The final answer plus repo/sync summary is rendered to stdout.

## Main modules

- `src/cli.js`
  Dispatches commands, resolves question files, and prints output.
- `src/config-paths.js`
  Resolves the active config path and default managed repos root.
- `src/config.js`
  Loads and validates config, and bootstraps a config file from scratch or from an imported catalog.
- `src/repo-selection.js`
  Performs lightweight token-based repo scoring and alias matching, then falls back to the first configured repo.
- `src/repo-sync.js`
  Clones missing repos and fast-forwards existing repos to `main` or `master`.
- `src/codex-runner.js`
  Wraps `codex exec`, manages the prompt, heartbeats, execution timeout, and final-message capture.
- `src/render.js`
  Converts results into simple CLI output.

## Configuration model

The installed config file owns:

- the root directory used for managed clones
- the list of managed repos

Repo definitions include:

- `name`
- `url`
- `defaultBranch`
- `description`
- `topics`
- optional `aliases`

## Testing model

- Vitest is used for unit tests.
- Coverage is enforced on statements and branches.
- The highest-value tests cover:
  - argument parsing
  - config loading and initialization
  - repo selection
  - Codex runner behavior and error handling
