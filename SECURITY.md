# Security Policy

## Security Model

Gutter is designed to run safely on untrusted pull requests in CI:

1. **`pull_request` only, never `pull_request_target`.** Gutter parses repository files and git history as inert text and never executes code from the pull request under analysis.
2. **Fork-safe by default.** Pull requests from forks receive a read-only `GITHUB_TOKEN`. Gutter detects fork PRs (and permission errors) and writes the briefing to the GitHub Actions job summary and workflow artifact instead of failing the build.
3. **Hostile-input escaping.** Pull request titles, descriptions, commit subjects, author names, and file paths are treated as untrusted input:
   - HTML-escaped in `gutter.html`
   - Markdown-escaped with defused `@mentions` (`@\u200b`) and dynamic backtick fences in `brief.md`
   - Repository links are emitted only when built from `http(s)://` base URLs and validated hexadecimal commit SHAs
4. **Argument-vector subprocesses.** Git and Repo Archaeology are invoked via `execFileSync` argument arrays, never shell strings.
5. **No external telemetry.** Gutter does not transmit source code, diffs, or git history to any Gutter-operated server.

## Supported Versions

| Version | Supported |
|---|---|
| `0.1.x` | Yes |

## Reporting a Vulnerability

Please report security vulnerabilities privately via [GitHub Security Advisories](https://github.com/lbrodie11/gutter/security/advisories/new) rather than opening a public issue. Include a minimal reproduction (for example, a synthetic git repository or `gutter.json` fixture) and the affected surface (CLI, GitHub Action, Markdown renderer, or HTML renderer).
