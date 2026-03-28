# Documentation Pipeline Workflow

Comprehensive documentation generation: API docs, ADRs, changelog, user guides, onboarding.

## Phase 1: API Documentation

Generate API documentation.
- Scan all API endpoints (routes, controllers)
- Document each endpoint: method, path, request body, response, errors
- Include working curl/httpx examples
- Generate OpenAPI/Swagger spec if applicable
- Output: API reference documentation

## Phase 2: ADR Capture

**Agent**: architect

Document architecture decisions.
- Review recent code changes and architectural patterns
- For each significant decision, create an ADR:
  - Context: What problem was being solved
  - Options: At least 2 alternatives considered
  - Decision: Which option was chosen and why
  - Consequences: Trade-offs and implications
- Output: ADR documents in docs/adr/

## Phase 3: Changelog Generation

**Agent**: tech-writer

Generate changelog from git history.
- Parse recent commits (conventional commits format)
- Group by: Added, Changed, Fixed, Removed, Security
- Include relevant PR/issue references
- Output: CHANGELOG.md update

## Phase 4: User Guide

**Agent**: tech-writer

Write/update user documentation.
- Getting started guide with prerequisites
- Step-by-step tutorials for common workflows
- Configuration reference
- Troubleshooting section with common errors
- Output: User guide documentation

## Phase 5: Developer Onboarding

**Agent**: tech-writer

Create/update developer onboarding guide.
- Local development setup (step-by-step)
- Architecture overview (high-level)
- Code conventions and patterns
- Testing guidelines
- Deployment procedures
- Output: CONTRIBUTING.md or docs/onboarding.md

## Phase 6: Documentation Review

**Agent**: lead-dev

Review all generated documentation.
- Verify technical accuracy
- Check code examples actually work
- Ensure no sensitive information is exposed
- Verify GitHub-compatible Markdown formatting
- Output: [APPROVE] or [VETO] with corrections