import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.db import get_pool
from core.deps import get_current_user

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


class SetCreate(BaseModel):
    name: str


class QuestionCreate(BaseModel):
    topic: str
    question: str
    type: str = "open"
    key_points: Optional[str] = None
    options: Optional[list[str]] = None
    correct_index: Optional[int] = None
    explanation: Optional[str] = None


def _parse_q(row: dict, user_id: str) -> dict:
    d = dict(row)
    d["is_mine"] = str(d["user_id"]) == str(user_id)
    if d.get("options") and isinstance(d["options"], str):
        d["options"] = json.loads(d["options"])
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


# ── Sets ────────────────────────────────────────────────────────────────────

@router.get("/sets")
async def list_sets(only_mine: bool = False, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    if only_mine:
        rows = await pool.fetch(
            "SELECT s.id, s.user_id, s.name, s.created_at, "
            "COUNT(q.id)::int AS question_count "
            "FROM quiz_sets s LEFT JOIN quiz_questions q ON q.set_id = s.id "
            "WHERE s.user_id = $1 GROUP BY s.id ORDER BY s.created_at DESC",
            user["id"],
        )
    else:
        rows = await pool.fetch(
            "SELECT s.id, s.user_id, s.name, s.created_at, "
            "COUNT(q.id)::int AS question_count "
            "FROM quiz_sets s LEFT JOIN quiz_questions q ON q.set_id = s.id "
            "GROUP BY s.id ORDER BY s.created_at DESC",
        )
    result = []
    for r in rows:
        d = dict(r)
        d["is_mine"] = str(d["user_id"]) == str(user["id"])
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result


@router.post("/sets", status_code=201)
async def create_set(body: SetCreate, user: dict = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Название не может быть пустым")
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO quiz_sets (user_id, name) VALUES ($1, $2) "
        "RETURNING id, user_id, name, created_at",
        user["id"], body.name.strip(),
    )
    d = dict(row)
    d["is_mine"] = True
    d["question_count"] = 0
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()
    return d


@router.delete("/sets/{set_id}", status_code=204)
async def delete_set(set_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM quiz_sets WHERE id = $1 AND user_id = $2",
        set_id, user["id"],
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Набор не найден")


# ── Questions ────────────────────────────────────────────────────────────────

@router.get("/sets/{set_id}/questions")
async def list_questions(set_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, user_id, topic, question, type, key_points, options, "
        "correct_index, explanation, created_at FROM quiz_questions "
        "WHERE set_id = $1 ORDER BY created_at ASC",
        set_id,
    )
    return [_parse_q(dict(r), user["id"]) for r in rows]


@router.post("/sets/{set_id}/questions", status_code=201)
async def add_question(
    set_id: int, body: QuestionCreate, user: dict = Depends(get_current_user)
):
    if body.type not in ("open", "multiple-choice"):
        raise HTTPException(status_code=400, detail="Неверный тип вопроса")
    if body.type == "open" and not body.key_points:
        raise HTTPException(status_code=400, detail="Укажите ключевые моменты")
    if body.type == "multiple-choice":
        if not body.options or len(body.options) < 2:
            raise HTTPException(status_code=400, detail="Нужно минимум 2 варианта ответа")
        if body.correct_index is None:
            raise HTTPException(status_code=400, detail="Укажите правильный ответ")

    pool = await get_pool()
    s = await pool.fetchrow("SELECT user_id FROM quiz_sets WHERE id = $1", set_id)
    if not s:
        raise HTTPException(status_code=404, detail="Набор не найден")
    if str(s["user_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Нет доступа")

    options_str = json.dumps(body.options, ensure_ascii=False) if body.options else None
    row = await pool.fetchrow(
        "INSERT INTO quiz_questions "
        "(set_id, user_id, topic, question, type, key_points, options, correct_index, explanation) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) "
        "RETURNING id, user_id, topic, question, type, key_points, options, "
        "correct_index, explanation, created_at",
        set_id, user["id"], body.topic, body.question, body.type,
        body.key_points, options_str, body.correct_index, body.explanation,
    )
    return _parse_q(dict(row), user["id"])


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(question_id: int, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM quiz_questions WHERE id = $1 AND user_id = $2",
        question_id, user["id"],
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Вопрос не найден")
