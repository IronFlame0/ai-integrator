import sys
import os
import types
from unittest.mock import MagicMock

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-tests")

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# fitz (pymupdf) не установлен локально — stub для тестов
if "fitz" not in sys.modules:
    fitz_stub = types.ModuleType("fitz")

    class _FakePage:
        def __init__(self, text="Hello PDF"):
            self._text = text
        def get_text(self):
            return self._text

    class _FakeDoc:
        def __init__(self, stream=None, filetype=None):
            pass
        def __iter__(self):
            return iter([_FakePage()])
        def close(self):
            pass

    fitz_stub.open = MagicMock(side_effect=_FakeDoc)
    sys.modules["fitz"] = fitz_stub

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
async def client() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
