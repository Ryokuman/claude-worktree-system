# Claude Worktree System

## Project Overview
Git worktree-based multi-branch development environment web dashboard.
See `SPEC.md` for detailed specifications.

## Tech Stack
- Next.js (App Router) + Custom server (server.ts)
- xterm.js + node-pty (web terminal)
- WebSocket (terminal communication)
- chokidar (git change detection)

## Key Rules
- Worktree data: `work-trees/` (active.json, deactive.json, ended.json)
- Plan data: `plan/active/{branchName}/`, `plan/ended/{branchName}/`
- No restrictions on plan file format or count
- taskNo rule: extract `DV-NNN` from branch name, otherwise auto-assign `TTN-N`
- Config: `.env` (see `.env.example`)

## Project Structure
- `server.ts` - Custom HTTP server wrapping Next.js, handles WebSocket upgrades
- `src/lib/` - Core logic (store, git, terminal, process management)
- `src/app/api/` - API routes
- `src/app/` - Pages (dashboard, plan viewer, ended list)
- `src/components/` - React components
- `work-trees/` - JSON data files (gitignored)
- `plan/` - Plan files per branch (gitignored)

## Target Project
- Configured via `.env` (MAIN_REPO_PATH, WORKTREE_BASE_DIR)
- Target project must expose a health check endpoint (configurable via HEALTHCHECK_PATH)
