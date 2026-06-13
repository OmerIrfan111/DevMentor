from app.band.client import BandClient


async def create_session_room(session_id: str, repo_url: str) -> str:
    client = BandClient()
    return await client.create_room(session_id, repo_url)
