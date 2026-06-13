from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient | None = None


def get_db():
    return client[settings.db_name]


async def connect_db():
    global client
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await client.admin.command("ping")


async def close_db():
    global client
    if client:
        client.close()
