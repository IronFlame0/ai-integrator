from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from core.db import get_pool
from core.deps import get_current_user
import fitz  # pymupdf

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 МБ


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Только PDF файлы")

    chunks = []
    total = 0
    while True:
        chunk = await file.read(65536)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 50 МБ)")
        chunks.append(chunk)
    data = b"".join(chunks)

    try:
        pdf = fitz.open(stream=data, filetype="pdf")
        pages = [page.get_text() for page in pdf]
        pdf.close()
        text = "\n".join(pages).strip()
    except Exception:
        raise HTTPException(status_code=422, detail="Не удалось открыть PDF")

    if not text:
        raise HTTPException(
            status_code=422,
            detail="PDF не содержит текста — возможно, это сканированный документ (изображения не поддерживаются)",
        )

    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO documents (user_id, filename, content, file_size) "
        "VALUES ($1, $2, $3, $4) "
        "RETURNING id, filename, file_size, created_at",
        user["id"], file.filename, text, len(data),
    )
    return dict(row)


@router.get("")
async def list_documents(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, filename, file_size, created_at FROM documents "
        "WHERE user_id = $1 ORDER BY created_at DESC",
        user["id"],
    )
    return [dict(r) for r in rows]


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM documents WHERE id = $1 AND user_id = $2",
        doc_id, user["id"],
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Документ не найден")


@router.get("/{doc_id}/text")
async def get_document_text(doc_id: str, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, filename, content FROM documents WHERE id = $1 AND user_id = $2",
        doc_id, user["id"],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return dict(row)
