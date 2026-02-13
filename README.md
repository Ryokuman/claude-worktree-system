# Claude Worktree System

Git worktree 기반 멀티 브랜치 개발 환경을 웹 대시보드로 관리합니다.

브랜치별 독립 worktree 생성, dev 서버 실행/정지, 플랜 관리, Claude Code 연동까지 하나의 대시보드에서 처리합니다.

## Features

- **Worktree 관리** — 웹 UI에서 git worktree 생성/완료
- **Dev 서버 제어** — worktree별 dev 서버 원클릭 시작/정지
- **Health 모니터링** — 실행 중인 서버 자동 헬스체크, 장애 감지
- **웹 터미널** — xterm.js + node-pty 기반 브라우저 터미널
- **플랜 시스템** — JSON 인덱스 + MD 파일 구조의 개발 플랜 관리
- **AI 플랜 생성** — Claude Code를 터미널에서 실행하여 플랜 자동 작성
- **양방향 플랜 동기화** — 핸들러 ↔ worktree `.claude/plan/` 자동 동기화
- **자동 브랜치 감지** — git refs 변경 감시, 브랜치 자동 분류

## Quick Start

### 1. 설치

```bash
git clone <repo-url>
cd claude-worktree-system
npm install
```

> **`sudo npm install` 하지 마세요.** node-pty 네이티브 바이너리 실행 권한이 깨집니다.
> npm 권한 에러 시: `sudo chown -R $(whoami) ~/.npm` 후 다시 `npm install`

### 2. 환경 설정

```bash
cp .env.example .env
```

`.env` 편집:

```env
PROJECT_NAME=your-project
MAIN_REPO_PATH=/path/to/your/repo          # 관리할 git 저장소의 절대 경로
WORKTREE_BASE_DIR=/path/to/worktree/parent  # worktree가 생성될 상위 디렉토리
```

### 3. 실행

```bash
npm run dev
```

`http://localhost:3000`에서 대시보드에 접근합니다.

## Environment Variables

| 변수 | 설명 | 기본값 |
|---|---|---|
| `PROJECT_NAME` | 대시보드 표시명, worktree 디렉토리 접두사 | `MyProject` |
| `MAIN_REPO_PATH` | 관리할 git 저장소 절대 경로 | **(필수)** |
| `WORKTREE_BASE_DIR` | worktree 생성 상위 디렉토리 | **(필수)** |
| `HANDLER_PORT` | 핸들러 대시보드 포트 | `3000` |
| `PORT_RANGE_START` | worktree dev 서버 포트 범위 시작 | `3001` |
| `PORT_RANGE_END` | worktree dev 서버 포트 범위 끝 | `3099` |
| `HEALTHCHECK_INTERVAL` | 헬스체크 주기 (ms) | `10000` |
| `HEALTHCHECK_PATH` | 헬스체크 엔드포인트 경로 | `/` |

## 사용 흐름

### 기본 워크플로

```
브랜치 감지 → Add(worktree 생성) → Start(dev 서버) → 개발 → Stop → Complete(아카이브)
```

1. **브랜치 감지** — `.git/refs` 변경 감시, `git branch -a`로 브랜치 수집 후 자동 분류
2. **Add** — deactive 브랜치 목록에서 선택 → git worktree 생성, 포트 자동 할당
3. **Start** — `npm install` + `npx next dev -p {port}` 실행
4. **Health Check** — 실행 중인 서버에 `HEALTHCHECK_PATH`로 주기적 폴링, 장애 시 stopped 처리
5. **Stop** — 프로세스 그룹 SIGTERM으로 종료
6. **Complete** — 플랜 아카이브(`plan/ended/`), worktree 정리, ended 목록으로 이동

### 플랜 시스템

각 브랜치별 개발 플랜을 구조화된 형태로 관리합니다.

**저장 구조:**

```
plan/active/{branchName}/
├── plan.json       # 인덱스 (제목, 스텝 목록, 상태)
├── 01-setup.md     # 스텝별 상세 명세
├── 02-auth.md
└── 03-api.md
```

**plan.json 형식:**

```json
{
  "title": "유저 인증 시스템",
  "steps": [
    { "id": "01", "title": "프로젝트 셋업", "file": "01-setup.md", "status": "done" },
    { "id": "02", "title": "인증 구현", "file": "02-auth.md", "status": "in_progress" },
    { "id": "03", "title": "API 엔드포인트", "file": "03-api.md", "status": "pending" }
  ]
}
```

**뷰 모드:**
- **구조화 뷰** — 진행 바, 스텝별 상태 토글(대기→진행중→완료), 상세 펼치기/편집
- **Raw 뷰** — 파일 직접 편집 (plan.json 포함)

**AI 플랜 생성:**
- 플랜 페이지에서 "AI로 플랜 만들기" 클릭
- Claude Code가 터미널에서 실행되어 프로젝트 코드를 분석하고 플랜 작성
- cwd = worktree 경로 (코드 접근), 출력 = `.claude/plan/` (자동 동기화)

**양방향 동기화:**
- `plan/active/{branch}/` → `{worktree}/.claude/plan/` + `RULES.md` 자동 생성
- `{worktree}/.claude/plan/` → `plan/active/{branch}/` (RULES.md 제외)
- Claude Code가 worktree에서 플랜을 수정하면 웹 UI에 자동 반영, 그 반대도 동일

### 헬스체크

대상 프로젝트에 헬스체크 엔드포인트가 있으면 서버 상태를 자동 모니터링합니다.

**Next.js 예시:**

```ts
// src/app/api/healthz/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
```

워크트리별로 개별 경로를 지정할 수도 있습니다 (Add 시 설정). 기본값은 `/`입니다.

## taskNo 규칙

- 브랜치명에 `DV-NNN` 패턴이 있으면 추출 (예: `feat/DV-494-auth` → `DV-494`)
- 없으면 자동 부여: `TTN-1`, `TTN-2`, ...

## API Endpoints

### 상태 조회

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/status` | 전체 시스템 상태 (active, deactive, ended) |
| `GET` | `/api/branches` | deactive 브랜치 목록 |
| `POST` | `/api/refresh` | git 상태 재스캔 |

### Worktree 관리

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/worktrees` | 활성 worktree 목록 |
| `POST` | `/api/worktrees` | worktree 생성 `{ branch, healthCheckPath? }` |
| `POST` | `/api/worktrees/:taskNo/start` | dev 서버 시작 |
| `POST` | `/api/worktrees/:taskNo/stop` | dev 서버 정지 |
| `POST` | `/api/worktrees/:taskNo/complete` | worktree 완료 (아카이브) |

### 플랜 관리

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/plan/:branch` | 플랜 조회 (structured/raw/empty) |
| `PUT` | `/api/plan/:branch` | 파일 내용 수정 `{ filename, content }` |
| `PATCH` | `/api/plan/:branch` | 스텝 상태 변경 `{ stepId, status }` |
| `DELETE` | `/api/plan/:branch` | 스텝 삭제 `{ stepId }` |

### 터미널

| Protocol | Path | 설명 |
|---|---|---|
| `WebSocket` | `/ws/terminal?cwd=...&initialCommand=...` | PTY 세션 (직접 연결) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (http://localhost:3000)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │Plan Page │  │Terminal Modal │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │ REST API     │ REST API       │ WebSocket│
└───────┼──────────────┼────────────────┼──────────┘
        │              │                │
┌───────┴──────────────┴────────────────┴──────────┐
│  server.ts (Custom HTTP Server)                   │
│  ├── Next.js App Router (API routes + pages)      │
│  ├── WebSocket Server → PTY spawn (node-pty)      │
│  └── Background Services:                         │
│       ├── Git watcher (chokidar → .git/refs)      │
│       ├── Health checker (interval polling)        │
│       └── Plan sync (bidirectional, chokidar)     │
└───────────────────────────────────────────────────┘
        │                                   │
┌───────┴───────┐              ┌────────────┴───────┐
│  work-trees/  │              │  plan/              │
│  active.json  │              │  active/{branch}/   │
│  deactive.json│              │  ended/{branch}/    │
│  ended.json   │              │                     │
└───────────────┘              └─────────────────────┘
```

## Data Storage

| 경로 | 내용 | gitignored |
|---|---|---|
| `work-trees/active.json` | 활성 worktree 목록 | O |
| `work-trees/deactive.json` | 미등록 브랜치 목록 | O |
| `work-trees/ended.json` | 완료된 worktree 목록 | O |
| `plan/active/{branch}/` | 브랜치별 플랜 파일 | O |
| `plan/ended/{branch}/` | 아카이브된 플랜 | O |
| `{worktree}/.claude/plan/` | worktree 내 플랜 사본 (자동 동기화) | — |

## Scripts

```bash
npm run dev      # 개발 서버 실행 (tsx server.ts)
npm run build    # Next.js 프로덕션 빌드
npm start        # 프로덕션 서버 실행
```

## Tech Stack

- **Next.js 15** (App Router) + Custom server
- **xterm.js 5** + **node-pty** — 브라우저 터미널
- **WebSocket** (`ws`) — 터미널 통신
- **chokidar** — git refs 및 플랜 파일 변경 감지
- **Tailwind CSS 4** — 스타일링
- **TypeScript 5**

## License

MIT
