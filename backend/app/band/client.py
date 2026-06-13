from thenvoi_rest import AsyncRestClient, ChatRoomRequest, ChatEventRequest
from band.client.rest import DEFAULT_REQUEST_OPTIONS
from app.config import settings


class BandClient:
    def __init__(self) -> None:
        self._rest = AsyncRestClient(api_key=settings.band_api_key)

    async def create_room(self, session_id: str, repo_url: str) -> str:
        result = await self._rest.agent_api_chats.create_agent_chat(
            chat=ChatRoomRequest(),
            request_options=DEFAULT_REQUEST_OPTIONS,
        )
        return result.data.id

    async def post_message(self, room_id: str, payload: dict) -> str:
        agent = payload.get("agent_name", "agent").upper()
        output_type = payload.get("output_type", "EVENT")
        preview = str(payload.get("content", ""))[:120]
        result = await self._rest.agent_api_events.create_agent_chat_event(
            room_id,
            event=ChatEventRequest(
                content=f"[{agent}] {output_type}: {preview}",
                message_type="tool_result",
                metadata=payload,
            ),
            request_options=DEFAULT_REQUEST_OPTIONS,
        )
        return result.data.id

    async def get_room_messages(self, room_id: str) -> list[dict]:
        result = await self._rest.agent_api_context.get_agent_chat_context(
            room_id,
            page_size=100,
            request_options=DEFAULT_REQUEST_OPTIONS,
        )
        messages = []
        for msg in result.data:
            if msg.metadata and "agent_name" in msg.metadata:
                messages.append({**msg.metadata, "_band_message_id": msg.id})
        return messages
