import pytest
from jose import JWTError
from core.security import hash_password, verify_password, create_token, decode_token


def test_hash_and_verify():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed)


def test_verify_wrong_password():
    hashed = hash_password("secret123")
    assert not verify_password("wrong", hashed)


def test_create_and_decode_token():
    token = create_token("user-id-123", "test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "user-id-123"
    assert payload["email"] == "test@example.com"


def test_decode_invalid_token():
    with pytest.raises(JWTError):
        decode_token("invalid.token.here")
