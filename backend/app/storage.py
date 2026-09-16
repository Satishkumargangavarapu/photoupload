import cloudinary
import cloudinary.uploader
from .config import get_settings


def configure_cloudinary():
    s = get_settings()
    cloudinary.config(cloud_name=s.cloudinary_cloud_name, api_key=s.cloudinary_api_key, api_secret=s.cloudinary_api_secret, secure=True)


async def upload_image(contents: bytes, filename: str) -> dict:
    configure_cloudinary()
    result = cloudinary.uploader.upload(contents, resource_type="image", folder="event-gallery", public_id=None)
    return {"url": result["secure_url"], "key": result["public_id"]}

