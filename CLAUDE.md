# AI Integrator

## Автоматические правила поведения

### Замечания во время работы
Если в процессе выполнения любой задачи я обнаруживаю что-либо из перечисленного — я **обязан** сразу записать это в `.claude/NOTES.md`, не ожидая просьбы:
- Потенциальный баг или уязвимость
- Технический долг или плохой паттерн
- Риск (например, отсутствие обработки ошибок, небезопасный код)
- Архитектурное несоответствие
- Вопрос, требующий решения

Формат записи:
```
## [YYYY-MM-DD] <заголовок>

**Файл:** <путь>
**Тип:** <баг | техдолг | риск | улучшение | вопрос>

<описание>

---
```

### После завершения изменений кода
После того как я завершил реализацию задачи (внёс все изменения в файлы), я **обязан** автоматически выполнить следующий воркфлоу без дополнительных просьб:

**Шаг 1 — Обновить тесты.**
Найти тесты для изменённых модулей и обновить/добавить их под новое поведение.

**Шаг 2 — Запустить тесты.**
Единая команда: `bash scripts/test.sh` (выводит только ошибки).
E2E: `bash scripts/test.sh --e2e` (требует работающий docker compose).

**Шаг 3 — Исправить ошибки.**
Если тесты упали — прочитать ошибки, найти причину, исправить, повторить Шаг 2. Максимум 3 итерации, затем сообщить пользователю.

**Шаг 4 — Ревью.**
Запустить агента-ревьюера с `git diff HEAD`. Агент проверяет: логику, безопасность, edge cases, соответствие архитектуре. Критические замечания — исправить и вернуться к Шагу 2.

**Шаг 5 — Предложить коммит-сообщение.**
Сформировать и вывести коммит-сообщение в блоке кода. Формат: `<тип>(<scope>): <описание>`. Не делать `git commit` автоматически.



## Стек
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Vercel AI SDK v4
- **Backend**: FastAPI (Python 3.12), asyncpg, bcrypt, python-jose
- **БД**: Supabase (PostgreSQL + pgvector) — Transaction pooler, порт 6543
- **AI**: Google Gemini через `@ai-sdk/google` (фронт) и openai-compatible endpoint (бэк)

## Запуск
```bash
docker compose up -d
docker compose build api && docker compose up -d --force-recreate api
docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend
docker compose logs -f api
docker compose logs -f frontend
```

## Переменные окружения (.env)
```
GEMINI_API_KEY      — ключ от Google AI Studio
GEMINI_MODEL        — gemini-2.5-flash (дефолт)
SUPABASE_DB_URL     — Transaction pooler URL (порт 6543)
SUPABASE_URL        — https://[ref].supabase.co
SUPABASE_ANON_KEY   — Publishable key
JWT_SECRET          — секрет JWT
JWT_ALGORITHM       — HS256
JWT_EXPIRE_MINUTES  — 10080 (7 дней)
```

## Структура проекта
```
apps/
  frontend/
    app/
      (auth)/
        login/page.tsx
        register/page.tsx
      api/
        auth/login/route.ts         proxy → FastAPI
        auth/register/route.ts      proxy → FastAPI
        chat/route.ts               Vercel AI SDK → Gemini (выбор модели из body)
        chats/route.ts              proxy → GET/POST /api/chats
        chats/[chatId]/messages/    proxy → GET/POST сообщения чата
        chats/[chatId]/title/       proxy → PATCH заголовок чата
        usage/today/route.ts        proxy → GET лимиты
        usage/increment/route.ts    proxy → POST счётчик
      page.tsx                      главная — sidebar + чат
    components/
      chat.tsx                      useChat + история + лимиты + выбор модели
    lib/
      auth.ts                       apiLogin, apiRegister, saveToken, getToken, getUser, logout
      chats.ts                      fetchChats, createChat, fetchMessages, saveMessages, fetchUsage, incrementUsage
  api/
    core/
      db.py                         asyncpg pool (statement_cache_size=0 — обязательно!)
      security.py                   bcrypt + JWT
      deps.py                       get_current_user dependency
    routers/
      auth.py                       register, login, me
      chats.py                      CRUD чатов, сообщения, лимиты usage
      chat.py                       streaming (не используется фронтом напрямую)
    services/
      llm.py                        stream_chat через openai-compatible Gemini
    main.py
infra/
  postgres/init.sql                 схема — выполнить в Supabase SQL Editor
```

## Архитектура запросов
```
Браузер → /api/chat                → Vercel AI SDK → Gemini API (с выбором модели)
Браузер → /api/auth/*              → Next.js proxy → FastAPI → Supabase
Браузер → /api/chats/*             → Next.js proxy → FastAPI → Supabase
Браузер → /api/usage/*             → Next.js proxy → FastAPI → Supabase
(никогда напрямую к localhost:8000 — CORS)
```

## БД — таблицы (Supabase)
```sql
users      — id, email, hashed_password, is_active, created_at
chats      — id, user_id, title, created_at, updated_at
messages   — id, chat_id, user_id, role, content, created_at
usage      — id, user_id, date, request_count (UNIQUE user_id+date)
documents  — id, user_id, content, embedding vector(1536), metadata, created_at
```

## Аутентификация
- bcrypt хеш пароля, JWT токен (7 дней) в localStorage
- Защищённые роуты через Depends(get_current_user) на бэке
- Все запросы к FastAPI передают Authorization: Bearer <token>

## Важные нюансы
- Supabase + asyncpg: statement_cache_size=0 обязательно (Transaction pooler)
- Пароль в URL: @ → %40, ! → %21
- node_modules: при новых npm пакетах нужен build --no-cache
- CORS: фронт ходит только через Next.js proxy routes

## Статус по плану  (Этап 1)

### Реализовано ✓
- Чат с AI + streaming ответов
- Аутентификация (регистрация, логин, JWT)
- История диалогов — sidebar как в ChatGPT, сохранение в Supabase
- Выбор модели (Gemini 2.5 Flash / 2.0 Flash / 2.5 Pro)
- Лимиты использования (50 запросов/день, счётчик в UI)
- Vercel AI SDK
- Supabase

### Не реализовано ✗
- Несколько провайдеров (OpenAI, Claude — сейчас только Gemini)

### Следующий этап: 2 — UI improvements
- Markdown rendering в сообщениях
- Улучшение UX sidebar (переименование, удаление чатов)
- System prompt настройки
- Лимиты использования (расчёт через токены)