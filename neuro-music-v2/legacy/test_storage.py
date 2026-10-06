"""Tests for storage service."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from io import BytesIO
from PIL import Image

from backend.services.storage import (
    verify_magic_bytes,
    generate_random_filename,
    upload_avatar,
    _upload_to_s3_compatible,
    _upload_to_local,
    delete_avatar,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
)
from backend.config import settings


class TestVerifyMagicBytes:
    def test_verify_png_magic_bytes(self):
        png_header = b"\x89PNG\r\n\x1a\n" + b"x" * 100
        assert verify_magic_bytes(png_header, "image/png") is True

    def test_verify_jpeg_magic_bytes(self):
        jpeg_header = b"\xff\xd8\xff" + b"x" * 100
        assert verify_magic_bytes(jpeg_header, "image/jpeg") is True

    def test_verify_webp_magic_bytes(self):
        webp_header = b"RIFF" + b"x" * 4 + b"WEBP" + b"x" * 100
        assert verify_magic_bytes(webp_header, "image/webp") is True

    def test_verify_invalid_magic_bytes(self):
        invalid = b"not an image"
        assert verify_magic_bytes(invalid, "image/png") is False
        assert verify_magic_bytes(invalid, "image/jpeg") is False
        assert verify_magic_bytes(invalid, "image/webp") is False

    def test_verify_unknown_mime_type(self):
        assert verify_magic_bytes(b"data", "image/gif") is False


class TestGenerateRandomFilename:
    def test_generate_random_filename(self):
        filename = generate_random_filename("png")
        assert filename.endswith(".png")
        assert len(filename) == 36  # 32 hex chars + .png

    def test_generate_unique_filenames(self):
        filenames = {generate_random_filename("jpg") for _ in range(100)}
        assert len(filenames) == 100


class TestUploadAvatar:
    @pytest.fixture
    def mock_upload_file(self):
        """Create a mock UploadFile with valid PNG content."""
        img = Image.new("RGB", (100, 100), color="red")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        content = buffer.getvalue()

        mock_file = MagicMock()
        mock_file.read = AsyncMock(return_value=content)
        mock_file.filename = "test.png"
        mock_file.content_type = "image/png"
        return mock_file

    @pytest.mark.asyncio
    async def test_upload_avatar_no_storage_provider(self, mock_upload_file):
        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = None

            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await upload_avatar(mock_upload_file, 1)

            assert exc.value.status_code == 501
            assert "not configured" in exc.value.detail

    @pytest.mark.asyncio
    async def test_upload_avatar_file_too_large(self, mock_upload_file):
        large_content = b"x" * (MAX_FILE_SIZE + 1)
        mock_upload_file.read = AsyncMock(return_value=large_content)

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = "local"

            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await upload_avatar(mock_upload_file, 1)

            assert exc.value.status_code == 413
            assert "2 MB" in exc.value.detail

    @pytest.mark.asyncio
    async def test_upload_avatar_invalid_type(self, mock_upload_file):
        mock_upload_file.read = AsyncMock(return_value=b"not an image")

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = "local"

            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await upload_avatar(mock_upload_file, 1)

            assert exc.value.status_code == 400
            assert "Invalid file type" in exc.value.detail

    @pytest.mark.asyncio
    async def test_upload_avatar_valid_png_local(self, mock_upload_file):
        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = "local"
            mock_settings.STORAGE_PUBLIC_URL = None

            with patch("backend.services.storage._upload_to_local", return_value="/avatars/test.png") as mock_local:
                result = await upload_avatar(mock_upload_file, 1)

            assert result == "/avatars/test.png"
            mock_local.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_avatar_converts_rgba_to_rgb(self):
        """Test that RGBA images are converted to RGB for JPEG."""
        img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        content = buffer.getvalue()

        mock_file = MagicMock()
        mock_file.read = AsyncMock(return_value=content)
        mock_file.filename = "test.png"
        mock_file.content_type = "image/png"

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = "local"
            mock_settings.STORAGE_PUBLIC_URL = None

            with patch("backend.services.storage._upload_to_local", return_value="/avatars/test.jpg"):
                result = await upload_avatar(mock_file, 1)

            assert result == "/avatars/test.jpg"


class TestUploadToLocal:
    def test_upload_to_local(self, tmp_path):
        content = b"test content"
        key = "avatars/user_1/test.png"

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PUBLIC_URL = None

            # Temporarily change the base directory
            import backend.services.storage as storage_module
            original_base = storage_module.Path("avatars")
            storage_module.Path = lambda p: tmp_path / p if p == "avatars" else tmp_path / p

            result = _upload_to_local(key, content)

        assert result == f"/avatars/{key}"
        expected_path = tmp_path / key
        assert expected_path.exists()
        assert expected_path.read_bytes() == content

    def test_upload_to_local_with_public_url(self, tmp_path):
        content = b"test content"
        key = "avatars/user_1/test.png"

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PUBLIC_URL = "https://cdn.example.com"

            import backend.services.storage as storage_module
            original_base = storage_module.Path("avatars")
            storage_module.Path = lambda p: tmp_path / p if p == "avatars" else tmp_path / p

            result = _upload_to_local(key, content)

        assert result == f"https://cdn.example.com/{key}"


class TestDeleteAvatar:
    def test_delete_avatar_local(self, tmp_path):
        key = "avatars/user_1/test.png"
        file_path = tmp_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(b"test")

        with patch("backend.services.storage.settings") as mock_settings:
            mock_settings.STORAGE_PROVIDER = "local"
            mock_settings.STORAGE_PUBLIC_URL = None

            import backend.services.storage as storage_module
            storage_module.Path = lambda p: tmp_path / p if p == "avatars" else tmp_path / p

            result = delete_avatar(1, f"/avatars/{key}")

        assert result is True
        assert not file_path.exists()

    def test_delete_avatar_none_url(self):
        assert delete_avatar(1, "") is True
        assert delete_avatar(1, None) is True