# AI Integrator

A full-stack AI chat application with document analysis, powered by Google Gemini.

## Features

- **Streaming chat** with Google Gemini (2.5 Flash / 2.0 Flash / 2.5 Pro)
- **Chat history** — sidebar like ChatGPT, persisted in Supabase
- **Chat with PDF** — attach a PDF and ask questions about it (full-context approach, no RAG)
- **Model selection** per conversation
- **Daily token limits** with usage indicator
- **Auth** — register / login, JWT tokens (7 days)
- **Markdown rendering** in assistant messages
- **Rename / delete** chats

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK v4 |
| Backend | FastAPI (Python 3.12), asyncpg |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Google Gemini via `@ai-sdk/google` |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Google AI Studio API key
- Supabase project

### 1. Environment

Copy and fill in `.env`:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:6543/postgres
JWT_SECRET=your-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
```

### 2. Database

Run the SQL from `infra/postgres/init.sql` in your Supabase SQL Editor.

### 3. Run

```bash
docker compose up -d
```

Frontend → http://localhost:3000
API → http://localhost:8000/docs

### Rebuild after dependency changes

```bash
# Backend (e.g. new Python package)
docker compose build --no-cache api && docker compose up -d --force-recreate api

# Frontend (e.g. new npm package)
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
```

## Project Structure

```
apps/
  frontend/          Next.js app
    app/
      (auth)/        Login & register pages
      api/           Route handlers (proxy → FastAPI, AI streaming)
    components/      chat.tsx, document-badge.tsx, markdown-message.tsx, ...
    lib/             auth.ts, chats.ts, documents.ts
  api/               FastAPI app
    routers/         auth, chats, documents, chat, models
    core/            db pool, JWT, dependencies
    services/        LLM streaming
infra/
  postgres/init.sql  Database schema
```

## Architecture

```
Browser → /api/chat          → Vercel AI SDK → Gemini API
Browser → /api/auth/*        → Next.js proxy → FastAPI → Supabase
Browser → /api/chats/*       → Next.js proxy → FastAPI → Supabase
Browser → /api/documents/*   → Next.js proxy → FastAPI → Supabase
```

The frontend never calls the FastAPI server directly — all requests go through Next.js route handlers (avoids CORS).

## Chat with PDF

PDFs are uploaded once and stored per user. You can attach a document to any chat — the full extracted text is injected into the system prompt on every request.

**Limitation:** only text is extracted. Images, charts, and scanned pages are not supported.

## Running Tests

```bash
bash scripts/test.sh          # unit tests (backend + frontend)
bash scripts/test.sh --e2e    # + E2E (requires running docker compose)
```

## Daily Token Limit

Default: **100 000 tokens / day** per user. Configurable in `apps/api/routers/chats.py` (`DAILY_TOKEN_LIMIT`).
