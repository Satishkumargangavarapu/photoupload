from motor.motor_asyncio import AsyncIOMotorClient
from .config import get_settings


class Database:
    client: AsyncIOMotorClient | None = None

    @classmethod
    def connect(cls):
        settings = get_settings()
        cls.client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)

    @classmethod
    def get(cls):
        if cls.client is None:
            cls.connect()
        return cls.client[get_settings().mongodb_db]

    @classmethod
    def close(cls):
        if cls.client:
            cls.client.close()
            cls.client = None

