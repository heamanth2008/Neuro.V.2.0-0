"""Storage utilities for avatar uploads."""
import os
import uuid
from pathlib import Path
from typing import Optional
from io import BytesIO

from PIL import Image
from fastapi import UploadFile, HTTPException, status

from backend.config import settings


# Allowed MIME types and their magic bytes
ALLOWED_MIME_TYPES = {
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/webp": [b"RIFF", b"WEBP"],
}

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB


def verify_magic_bytes(file_bytes: bytes, mime_type: str) -> bool:
    """Verify file type by checking magic bytes."""
    signatures = ALLOWED_MIME_TYPES.get(mime_type, [])
    for sig in signatures:
        if file_bytes.startswith(sig):
            return True
    return False


def generate_random_filename(ext: str) -> str:
    """Generate a random filename with the given extension."""
    return f"{uuid.uuid4().hex}.{ext}"


async def upload_avatar(file: UploadFile, user_id: int) -> str:
    """
    Upload avatar to configured storage provider.
    Returns the public URL of the uploaded avatar.
    """
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 2 MB limit"
        )
    
    # Determine MIME type from content
    mime_type = None
    for mt, sigs in ALLOWED_MIME_TYPES.items():
        if verify_magic_bytes(content, mt):
            mime_type = mt
            break
    
    if not mime_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PNG, JPEG, and WebP are allowed."
        )
    
    # Re-encode with Pillow to strip metadata and ensure valid format
    try:
        img = Image.open(BytesIO(content))
        img.verify()  # Verify it's a valid image
        
        # Re-open for processing (verify() consumes the stream)
        img = Image.open(BytesIO(content))
        
        # Convert to RGB if necessary (for JPEG)
        if mime_type == "image/jpeg" and img.mode in ("RGBA", "LA", "P"):
            # Create white background for transparency
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if img.mode in ("RGBA", "LA"):
                background.paste(img, mask=img.split()[-1])
                img = background
            else:
                img = img.convert("RGB")
        
        # Resize to max 512x512 maintaining aspect ratio
        max_size = (512, 512)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save to bytes
        output = BytesIO()
        if mime_type == "image/png":
            img.save(output, format="PNG", optimize=True)
            ext = "png"
        elif mime_type == "image/jpeg":
            img.save(output, format="JPEG", quality=85, optimize=True)
            ext = "jpg"
        elif mime_type == "image/webp":
            img.save(output, format="WEBP", quality=85, method=6)
            ext = "webp"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format")
        
        processed_content = output.getvalue()
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {str(e)}"
        )
    
    # Generate filename
    filename = f"avatars/user_{user_id}/{generate_random_filename(ext)}"
    
    # Upload based on provider
    provider = settings.STORAGE_PROVIDER
    
    if provider == "r2" or provider == "s3":
        return await _upload_to_s3_compatible(filename, processed_content, mime_type)
    elif provider == "local":
        return _upload_to_local(filename, processed_content)
    else:
        # No storage configured - this shouldn't be called if upload is disabled
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Avatar upload not configured"
        )


async def _upload_to_s3_compatible(key: str, content: bytes, content_type: str) -> str:
    """Upload to S3-compatible storage (R2, S3, etc.)."""
    import boto3
    from botocore.config import Config
    
    if not all([settings.STORAGE_ENDPOINT, settings.STORAGE_BUCKET, 
                settings.STORAGE_ACCESS_KEY, settings.STORAGE_SECRET_KEY]):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage not fully configured"
        )
    
    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT,
        aws_access_key_id=settings.STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.STORAGE_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )
    
    try:
        s3_client.put_object(
            Bucket=settings.STORAGE_BUCKET,
            Key=key,
            Body=content,
            ContentType=content_type,
            ACL="public-read" if provider_is_public() else "private",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )
    
    if settings.STORAGE_PUBLIC_URL:
        return f"{settings.STORAGE_PUBLIC_URL.rstrip('/')}/{key}"
    
    # Generate presigned URL if no public URL
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.STORAGE_BUCKET, "Key": key},
            ExpiresIn=3600 * 24 * 365,  # 1 year
        )
        return url
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate file URL"
        )


def _upload_to_local(key: str, content: bytes) -> str:
    """Upload to local filesystem."""
    base_dir = Path("avatars")
    file_path = base_dir / key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    file_path.write_bytes(content)
    
    if settings.STORAGE_PUBLIC_URL:
        return f"{settings.STORAGE_PUBLIC_URL.rstrip('/')}/{key}"
    return f"/avatars/{key}"


def provider_is_public() -> bool:
    """Check if the storage provider should use public ACL."""
    # R2 with public bucket, or S3 with public bucket
    return settings.STORAGE_PUBLIC_URL is not None


def delete_avatar(user_id: int, avatar_url: str) -> bool:
    """Delete avatar from storage."""
    if not avatar_url:
        return True
    
    provider = settings.STORAGE_PROVIDER
    
    try:
        if provider in ("r2", "s3"):
            import boto3
            from botocore.config import Config
            
            # Extract key from URL
            if settings.STORAGE_PUBLIC_URL and avatar_url.startswith(settings.STORAGE_PUBLIC_URL):
                key = avatar_url.replace(settings.STORAGE_PUBLIC_URL.rstrip('/') + '/', '')
            else:
                # Try to extract from presigned URL
                return True  # Best effort
            
            s3_client = boto3.client(
                "s3",
                endpoint_url=settings.STORAGE_ENDPOINT,
                aws_access_key_id=settings.STORAGE_ACCESS_KEY,
                aws_secret_access_key=settings.STORAGE_SECRET_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
            s3_client.delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)
            return True
            
        elif provider == "local":
            if avatar_url.startswith("/avatars/"):
                key = avatar_url.replace("/avatars/", "")
                file_path = Path("avatars") / key
                if file_path.exists():
                    file_path.unlink()
                return True
    except Exception:
        pass
    
    return False