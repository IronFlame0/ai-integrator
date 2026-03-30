# AI Integrator

## Стек
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK v4
- **Backend**: FastAPI (Python 3.12), asyncpg, bcrypt, python-jose
- **БД**: Supabase (PostgreSQL + pgvector) — Transaction pooler, порт 6543
- **AI**: Google Gemini через `@ai-sdk/google` (фронт) и openai-compatible endpoint (бэк)

## Запуск
```bash
docker compose up -d                        # поднять всё
docker compose build api && docker compose up -d --force-recreate api   # пересобрать api
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend  # пересобрать фронт (если не ставятся npm пакеты)
docker compose up -d --force-recreate api  # перечитать .env без пересборки
docker compose logs -f api                 # логи Python API
docker compose logs -f frontend            # логи Next.js
```

## Переменные окружения (.env)
```
GEMINI_API_KEY     — ключ от Google AI Studio (aistudio.google.com)
GEMINI_MODEL       — название модели, сейчас: gemini-2.5-flash
SUPABASE_DB_URL    — Transaction pooler URL (порт 6543, не 5432)
SUPABASE_URL       — https://[ref].supabase.co
SUPABASE_ANON_KEY  — Publishable key из Supabase → Connect
JWT_SECRET         — секрет для подписи JWT токенов
JWT_ALGORITHM      — HS256
JWT_EXPIRE_MINUTES — 10080 (7 дней)
```

## Структура проекта
```
apps/
  frontend/                   Next.js
    app/
      (auth)/
        login/page.tsx        страница входа
        register/page.tsx     страница регистрации
      api/
        auth/
          login/route.ts      proxy → FastAPI /api/auth/login
          register/route.ts   proxy → FastAPI /api/auth/register
        chat/route.ts         Vercel AI SDK → Gemini (напрямую, без FastAPI)
      layout.tsx
      page.tsx                главная — чат (защищена, редирект на /login)
    components/
      chat.tsx                useChat от Vercel AI SDK
    lib/
      auth.ts                 apiLogin, apiRegister, saveToken, getToken, getUser, logout
  api/                        FastAPI
    core/
      db.py                   asyncpg pool (statement_cache_size=0 — обязательно для Supabase)
      security.py             bcrypt пароли + JWT токены
      deps.py                 get_current_user dependency
    routers/
      auth.py                 POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
      chat.py                 POST /api/chat (streaming, пока не используется фронтом)
    services/
      llm.py                  stream_chat через openai-compatible Gemini endpoint
    main.py                   FastAPI app, CORS, lifespan
infra/
  postgres/
    init.sql                  схема БД — выполнить вручную в Supabase SQL Editor
```

## Архитектура запросов
```
Браузер
  │
  ├── /api/chat          → Next.js route → Vercel AI SDK → Gemini API напрямую
  │
  ├── /api/auth/login    → Next.js proxy route → FastAPI :8000 → Supabase
  ├── /api/auth/register → Next.js proxy route → FastAPI :8000 → Supabase
  │
  └── (никогда напрямую к localhost:8000 — CORS)
```

## БД — таблицы (Supabase)
```sql
users      — id, email, hashed_password, is_active, created_at
messages   — id, user_id, role, content, created_at
documents  — id, user_id, content, embedding (vector 1536), metadata, created_at
```

## Аутентификация
- Регистрация/логин → FastAPI → bcrypt хеш пароля → JWT токен в ответе
- Токен хранится в `localStorage`
- Главная страница проверяет токен через `getUser()`, если нет — редирект на `/login`
- Защищённые API эндпоинты используют `Depends(get_current_user)`

## Важные нюансы
- **Supabase + asyncpg**: обязательно `statement_cache_size=0` в `create_pool()` — без этого `DuplicatePreparedStatementError`
- **Пароль в SUPABASE_DB_URL**: спецсимволы `@` и `!` нужно URL-encode (`@` → `%40`, `!` → `%21`)
- **node_modules в Docker**: при добавлении новых npm пакетов нужен `build --no-cache`, иначе volume кеширует старые модули
- **CORS**: фронт никогда не ходит напрямую к `localhost:8000` — только через Next.js proxy routes
- **Gemini модели**: `gemini-2.0-flash` имеет нулевую квоту на этом аккаунте, используем `gemini-2.5-flash`

## Текущий этап: 1 завершён — чат + аутентификация
## Следующий этап: 2 — история диалогов, sidebar, markdown rendering
