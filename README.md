# Claude Worktree System

Git worktree-based multi-branch development environment managed through a web dashboard.

Create independent worktrees for each branch, run dev servers per worktree, and manage plans — all from a single dashboard.

## Features

- **Worktree Management** - Create/remove git worktrees from a web UI
- **Dev Server Control** - Start/stop dev servers per worktree with one click
- **Health Monitoring** - Automatic health checks for running servers
- **Web Terminal** - Built-in xterm.js terminal for Claude Code planning sessions
- **Plan Management** - View and edit plan files per branch
- **Auto Branch Detection** - Watches git refs and auto-classifies branches

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd claude-worktree-system
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PROJECT_NAME=your-project
MAIN_REPO_PATH=/path/to/your/repo
WORKTREE_BASE_DIR=/path/to/worktree/parent
HEALTHCHECK_PATH=/api/healthz
```

### 3. Add Health Check Endpoint to Your Project

The handler monitors worktree dev servers via a health check endpoint. Add one to your target project:

**Next.js (App Router):**

```ts
// src/app/api/healthz/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
```

**Express:**

```ts
app.get("/api/healthz", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

Set `HEALTHCHECK_PATH` in `.env` to match your endpoint path (default: `/api/healthz`).

### 4. Run

```bash
npm run dev
```

Open `http://localhost:3000` to access the dashboard.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PROJECT_NAME` | Display name in dashboard & worktree directory prefix | `MyProject` |
| `MAIN_REPO_PATH` | Absolute path to the main git repository | (required) |
| `WORKTREE_BASE_DIR` | Parent directory for created worktrees | (required) |
| `HANDLER_PORT` | Port for the handler dashboard | `3000` |
| `PORT_RANGE_START` | Start of port range for worktree dev servers | `3001` |
| `PORT_RANGE_END` | End of port range for worktree dev servers | `3099` |
| `HEALTHCHECK_INTERVAL` | Health check polling interval in ms | `10000` |
| `HEALTHCHECK_PATH` | Health check endpoint path on target project | `/api/healthz` |

## How It Works

1. **Branch Detection** - Watches `.git/refs` for changes, runs `git branch -a` to collect branches
2. **Classification** - Compares branches against active worktrees, unregistered branches go to "deactive" list
3. **Add Worktree** - Pick a branch from deactive list, optionally open a terminal for planning, then create a git worktree
4. **Dev Server** - Start/stop `next dev` on the assigned port
5. **Health Check** - Polls running servers at `HEALTHCHECK_PATH` to detect crashes
6. **Complete** - Archive plan files and move worktree to ended list

## taskNo Rules

- If branch name contains `DV-NNN` pattern (e.g. `feat/DV-494-some-feature`), extracts `DV-494`
- Otherwise auto-assigns `TTN-1`, `TTN-2`, etc.

## Tech Stack

- **Next.js 15** (App Router) with custom server
- **WebSocket** (`ws`) for terminal communication
- **node-pty** for PTY sessions
- **xterm.js** for browser terminal
- **chokidar** for git file watching
- **Tailwind CSS 4** for styling

## License

MIT
