# AI Integrator

**Правила работы:** `.claude/workflow.md` — воркфлоу после изменений кода и формат замечаний.

---

## Стек
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK v4
- **Backend**: FastAPI (Python 3.12), asyncpg, bcrypt, python-jose
- **БД**: Supabase (PostgreSQL + pgvector) — Transaction pooler, порт 6543
- **AI (фронт)**: `@ai-sdk/google` + `@ai-sdk/openai` + `@ai-sdk/anthropic`
- **AI (бэк)**: openai-compatible endpoint (`services/llm.py`)

## Провайдеры и модели
Список отдаёт `GET /api/models` — только модели с заданным API-ключом в env.
```
Google:    gemini-2.5-flash, gemini-2.0-flash, gemini-2.5-pro   (context: 1M)
OpenAI:    gpt-4o, gpt-4o-mini, o3-mini                         (context: 128k/200k)
Anthropic: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 (context: 200k)
```

## Переменные окружения (.env)
```
# Обязательно
GEMINI_API_KEY / SUPABASE_DB_URL / SUPABASE_URL / SUPABASE_ANON_KEY
JWT_SECRET / JWT_ALGORITHM=HS256 / JWT_EXPIRE_MINUTES=10080

# Опционально (включают провайдера)
OPENAI_API_KEY / ANTHROPIC_API_KEY

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## Структура — нетривиальные детали

### Frontend `apps/frontend/`
| Путь | Что делает |
|------|-----------|
| `app/api/chat/route.ts` | Vercel AI SDK → мультипровайдер; модель + провайдер из body |
| `app/api/models/route.ts` | `cache: "no-store"` — обязательно, иначе Next.js кеширует |
| `app/api/documents/upload/route.ts` | Загрузка PDF → FastAPI → pgvector |
| `app/quiz/quiz-client.tsx` | JS-квиз: вопросы из `lib/quiz-questions.ts`, лимит попыток, AI-разбор |
| `components/chat.tsx` | useChat + история + лимиты + PDF-контекст + трейсинг + typing indicator |
| `components/markdown-message.tsx` | Markdown + кнопка ⏱ (TTFB, prompt/completion токены) |
| `lib/chats.ts` | fetchChats, createChat, fetchMessages, saveMessages, fetchUsage, incrementUsage |

### Backend `apps/api/`
| Путь | Что делает |
|------|-----------|
| `core/db.py` | asyncpg pool; `statement_cache_size=0` — обязательно для Transaction pooler |
| `routers/models.py` | Фильтрует ALL_MODELS по наличию API-ключа в env |
| `routers/documents.py` | upload/list/delete PDF; embedding через pgvector |
| `routers/chats.py` | CRUD чатов + сообщения + usage (токены/день) |
| `services/llm.py` | stream_chat через openai-compatible Gemini (бэк, фронтом не используется) |
| `tests/` | test_auth, test_chats, test_documents, test_models, test_security |

## Архитектура запросов
```
Браузер → /api/chat|quiz/*   → Vercel AI SDK → google|openai|anthropic (стриминг)
Браузер → /api/auth/*        → Next.js proxy → FastAPI → Supabase
Браузер → /api/chats/*       → Next.js proxy → FastAPI → Supabase
Браузер → /api/documents/*   → Next.js proxy → FastAPI → Supabase
Браузер → /api/models        → Next.js proxy → FastAPI (фильтр по ключам)
Браузер → /api/usage/*       → Next.js proxy → FastAPI → Supabase
(никогда напрямую к localhost:8000 — CORS)
```

## БД — таблицы
```sql
users     — id, email, hashed_password, is_active, created_at
chats     — id, user_id, title, created_at, updated_at
messages  — id, chat_id, user_id, role, content, created_at
usage     — id, user_id, date, request_count (UNIQUE user_id+date)
documents — id, user_id, content, embedding vector(1536), metadata, created_at
```

## Важные нюансы
- `statement_cache_size=0` в asyncpg — обязательно (Supabase Transaction pooler)
- Пароль в DB URL: `@` → `%40`, `!` → `%21`
- Новые npm-пакеты → `docker compose build --no-cache frontend`
- JWT в localStorage; все запросы к FastAPI: `Authorization: Bearer <token>`
- PDF к чату — полный контекст (full context, не RAG)
- Hot reload: `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d`

## Запуск
```bash
docker compose up -d
docker compose build api && docker compose up -d --force-recreate api
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
docker compose logs -f api|frontend
```

## Следующий этап
- System prompt настройки
- UI improvements
