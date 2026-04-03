import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from core.security import create_token

USER_ID = "user-uuid-123"
DOC_ID = "doc-uuid-789"
TOKEN = create_token(USER_ID, "user@example.com")
AUTH = {"Authorization": f"Bearer {TOKEN}"}

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
    b"/Contents 4 0 R /Resources << /Font << /F1 << /Type /Font "
    b"/Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n"
    b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET\nendstream\nendobj\n"
    b"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n"
    b"0000000058 00000 n\n0000000115 00000 n\n0000000274 00000 n\n"
    b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n370\n%%EOF"
)


@pytest.fixture
def mock_pool():
    return AsyncMock()


async def test_list_documents_empty(client, mock_pool):
    mock_pool.fetch.return_value = []
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/documents", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_documents(client, mock_pool):
    mock_pool.fetch.return_value = [
        {"id": DOC_ID, "filename": "report.pdf", "file_size": 1024, "created_at": "2024-01-01"}
    ]
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/documents", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["filename"] == "report.pdf"


async def test_upload_not_pdf(client, mock_pool):
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/documents/upload",
            files={"file": ("doc.txt", b"text content", "text/plain")},
            headers=AUTH,
        )
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


async def test_upload_pdf_success(client, mock_pool):
    mock_pool.fetchrow.return_value = {
        "id": DOC_ID, "filename": "test.pdf", "file_size": len(MINIMAL_PDF),
        "created_at": "2024-01-01"
    }
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/documents/upload",
            files={"file": ("test.pdf", MINIMAL_PDF, "application/pdf")},
            headers=AUTH,
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == DOC_ID
    assert data["filename"] == "test.pdf"


async def test_upload_empty_pdf(client, mock_pool):
    """PDF без текста (только изображения) должен вернуть 422."""
    class EmptyPage:
        def get_text(self):
            return ""

    class EmptyDoc:
        def __iter__(self):
            return iter([EmptyPage()])
        def close(self):
            pass

    import fitz
    with patch.object(fitz, "open", return_value=EmptyDoc()):
        with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
            resp = await client.post(
                "/api/documents/upload",
                files={"file": ("scan.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
                headers=AUTH,
            )
    assert resp.status_code == 422


async def test_delete_document(client, mock_pool):
    mock_pool.execute = AsyncMock(return_value="DELETE 1")
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.delete(f"/api/documents/{DOC_ID}", headers=AUTH)
    assert resp.status_code == 204


async def test_delete_document_not_found(client, mock_pool):
    mock_pool.execute = AsyncMock(return_value="DELETE 0")
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.delete(f"/api/documents/{DOC_ID}", headers=AUTH)
    assert resp.status_code == 404


async def test_get_document_text(client, mock_pool):
    mock_pool.fetchrow.return_value = {
        "id": DOC_ID, "filename": "report.pdf", "content": "Document text here."
    }
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get(f"/api/documents/{DOC_ID}/text", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "Document text here."


async def test_get_document_text_not_found(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.documents.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get(f"/api/documents/{DOC_ID}/text", headers=AUTH)
    assert resp.status_code == 404


async def test_documents_require_auth(client):
    resp = await client.get("/api/documents")
    assert resp.status_code == 403
